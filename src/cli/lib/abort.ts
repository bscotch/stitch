import chalk from "chalk";

export default function abort(message:string){
  console.log(chalk.red("ERROR!"),chalk.yellow(message));
  process.exit(1);
}
