const path = require('path');
const asar = require(path.join(__dirname, '..', 'node_modules', '@electron', 'asar'));

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('Usage: node pack-asar.cjs <src> <dest>');
  process.exit(1);
}

asar.createPackage(src, dest)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error packing asar:', err);
    process.exit(1);
  });

