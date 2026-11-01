import { SQL } from "bun";
import { config } from "../config";

const db = new SQL({
    adapter: "mysql",
    hostname: config.mysql.host,
    username: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    // MySQL 8 uses caching_sha2_password; Bun needs this (or TLS) over a plain connection
    allowPublicKeyRetrieval: true,
} as ConstructorParameters<typeof SQL>[0]);

export default db;
