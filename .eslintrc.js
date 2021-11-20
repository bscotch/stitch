module.exports = {
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'comma-dangle': ['error', 'only-multiline'],
    'space-before-function-paren': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
    'key-spacing': 'off',
    quotes: 'off',
    eqeqeq: 'off',
    camelcase: 'off',
    'require-await': 'error',
    'no-empty': 'off',
    'getter-return': 'off',
    'no-constant-condition': 'off',
    'no-prototype-builtins': 'off',
    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': ['error'],
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
