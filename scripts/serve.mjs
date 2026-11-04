import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    let data;
    try {
      data = await readFile(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(await readFile(resolve(root, "404.html")));
      return;
    }
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    if (pathname.startsWith("/downloads/"))
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="' + file.split(sep).pop() + '"',
      );
    res.end(data);
  } catch (error) {
    console.error("Local preview request failed:", error.code || error.name);
    res.writeHead(500);
    res.end("Preview request failed");
  }
});
const port = Number(process.env.PORT || 4317);
server.listen(port, "127.0.0.1", () =>
  console.log("Local: http://127.0.0.1:" + server.address().port),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
