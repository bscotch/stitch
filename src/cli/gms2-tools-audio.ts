#!/usr/bin/env node
import commander from "commander";
import audioImport from "./lib/audio-import";

export const cli = commander;

cli.description("Manage audio files")
  .option("-p --project <yyp>","Path of the project's YYP file. Will recursively look for YYP file starting from the current working directory if not specified.")
  .option("-s, --source <src>","Path to a specific file or to a directory of audio files (discovers .ogg, .mp3, and .wav files).")
  .parse(process.argv);

audioImport(cli.project,cli.source);
