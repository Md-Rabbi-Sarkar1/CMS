import express, { type Express } from "express";

const app: Express = express();
const port = Number(process.env.PORT ?? 4000);

app.disable("x-powered-by");
app.use(express.json());

const server = app.listen(port, () => {
  console.log(`API listening on port ${String(port)}`);
});

function shutdown(): void {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app };
