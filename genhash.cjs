const b = require('bcryptjs');
const h = b.hashSync('123', 10);
process.stdout.write(h);
