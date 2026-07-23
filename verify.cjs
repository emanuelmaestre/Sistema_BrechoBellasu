/* eslint-disable @typescript-eslint/no-require-imports */
const b = require("bcryptjs")
const hash = "$2b$10$eXdL55e39KPOB9ubcVoh0u3IE.wQtDVpjYzV4JAXlmox3sdJvd4rm"
console.log("bate:", b.compareSync("123", hash))
