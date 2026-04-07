import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { apiRoutes } from "./routes";

export const app = express();

const allowedOrigins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://grupogk.selfmachine.com.br",
	"https://maisquiosque.selfmachine.com.br",
];

const normalizedAllowedOrigins = allowedOrigins.map((origin) => origin.replace(/\/$/, ""));

app.use(helmet());
app.use(
	cors({
		origin: (origin, callback) => {
			const normalizedOrigin = origin?.replace(/\/$/, "");

			if (!normalizedOrigin || normalizedAllowedOrigins.includes(normalizedOrigin)) {
				callback(null, true);
				return;
			}

			callback(new Error("CORS: origin not allowed"));
		},
		credentials: true,
	}),
);
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);