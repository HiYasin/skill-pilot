// Process entry point: bin.mjs imports the built copy of this file.
import { SHOW_CURSOR, log, red, write } from "./colors.ts";
import { main } from "./main.ts";

process.on("SIGINT", () => {
  write(SHOW_CURSOR + "\n");
  process.exit(130);
});

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: Error) => {
    write(SHOW_CURSOR);
    log(red(`\n   Error: ${err.message}\n`));
    process.exitCode = 1;
  });
