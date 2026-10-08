import 'dotenv/config'
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect:"postgresql",
  schema:"./db/schemas/*",
  out:"./db/migrations",
  dbCredentials:{
    host:'127.0.0.1',
    port:Number(process.env.DATABASE_PORT),
    user:process.env.POSTGRES_USER!,
    password:process.env.POSTGRES_PASSWORD,
    database:process.env.POSTGRES_DB!,
    ssl:false
  }
})
