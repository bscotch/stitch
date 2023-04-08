import { Lexer } from 'chevrotain';
import { tokens } from './tokens.js';

export const GmlLexer = new Lexer(tokens);
