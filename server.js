require("dotenv").config();
const util = require("node:util");
const express = require("express");
const logger = require("morgan");
const http = require("http");
const { json, urlencoded } = require("body-parser");

const package = require("./package.json");

const app = express();

const { BACKING_SERVICE_BASE_URL, PROXY_VERB } = process.env;
if (!BACKING_SERVICE_BASE_URL) {
  throw new Error("Missing env: BACKING_SERVICE_BASE_URL");
}
if (!PROXY_VERB) {
  throw new Error("Missing env: PROXY_VERB");
}

// other global middlewares

app.use(
  logger(`[:date[iso]] ":method :url" :status - :req[content-length] bytes`)
);

// helpers

function logHeaders(headers) {
  for (const key in headers) {
    console.log(`${key}: \x1b[32m%s\x1b[0m`, headers[key]);
  }
}

function logBody(body) {
  console.log(
    util.inspect(body, {
      showHidden: false,
      compact: false,
      depth: null,
      colors: true,
    })
  );
}

// endpoints

app.post(/(.*)/, json(), async (req, res) => {
  const { headers, body } = req;

  //log request contents
  console.log("REQUEST:\n");
  logHeaders(headers);
  // console.log("Headers:", formatContent(headers));
  if (body) {
    logBody(body);
  } else {
    console.log("\x1b[33m%s\x1b[0m", "(no JSON body sent)");
  }

  // generate new url
  const newUrl = `${BACKING_SERVICE_BASE_URL}${req.originalUrl}`;

  // prepare request headers, removing ones that shouldn't be proxied
  const modifiedHeaders = { ...headers };
  delete modifiedHeaders.host;
  delete modifiedHeaders["content-length"];

  // proxy
  const response = await fetch(newUrl, {
    method: PROXY_VERB,
    body: body ? JSON.stringify(body) : "",
    headers: modifiedHeaders,
  });

  // parse response headers, removing ones that shouldn't be proxied
  const responseHeaders = Object.fromEntries(response.headers);
  delete responseHeaders["content-encoding"];

  // parse response body
  const responseBody = await response.text();

  // log response
  console.log("\nRESPONSE:\n");
  logHeaders(responseHeaders);
  if (responseBody) {
    try {
      logBody(JSON.parse(responseBody));
    } catch (_err) {
      console.log(responseBody);
    }
  } else {
    console.log("\x1b[33m%s\x1b[0m", "(no JSON body received)");
  }

  // respond
  res.set(responseHeaders);
  return res.status(response.status).send(responseBody);
});

// catch 404 and forward to error handler
app.use(function (_req, _res, next) {
  const err = new Error("Not Found");
  err.status = 404;

  next(err);
});

// error handler
app.use(function (err, _req, res, _next) {
  const { message, status = 500 } = err;
  const description = status >= 500 ? "Something unexpected happened" : message;
  const details = process.env.NODE_ENV !== "production" ? err.stack : "";

  if (status >= 500) {
    console.error("ERROR:", err);
  }
  res.status(status);

  return res.json({
    status,
    message: description,
    details,
  });
});

// start the server
const server = http.createServer(app);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(
    `${package.description} (v${package.version}), listening on port ${port}, proxying to: ${BACKING_SERVICE_BASE_URL}, with verb: ${PROXY_VERB}`
  );
});
