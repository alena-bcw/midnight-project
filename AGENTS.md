# Workspace agent rules

You build the user's app **inside this workspace directory**, which is your current
working directory. Everything you generate must live here so the Files panel and the
one-shot push (both scoped to this workspace) can see it.

## Paths — relative only, never absolute

- Create and edit files with **paths relative to this workspace** (e.g. `vc-dapp/src/App.tsx`).
- **Never** use an absolute path such as `/Users/.../vc-platform/vc-dapp`. This runtime
  resolves an absolute path *inside* the workspace, producing a nested
  `Users/.../vc-dapp` tree that the Files panel can never show — this is the "path got
  nested" failure. If you catch yourself about to write a leading-slash path, stop and
  make it relative.
- When a CLI scaffolder needs a target directory, give it a **bare relative name**
  (e.g. `vc-dapp`), not a full path.

## Commands must be non-interactive — there is no terminal

There is **no TTY** attached to this environment. Any command that stops to ask a
question will hang forever and freeze the chat. Before running a command, make it
answer every prompt up front:

- Pass all arguments explicitly. Never run a bare interactive scaffolder.
  - Use: `npm create vite@latest vc-dapp -- --template react-ts`
  - Not: `npm create vite` (prompts for project name + framework → hangs)
- Auto-confirm package installs. `npm_config_yes=true` is already set, so `npx` /
  `npm create` won't stop at "Ok to proceed?"; pass `--yes` / `-y` for anything else
  that may prompt.
- `CI=1` is already exported — prefer flags that honor it and other non-interactive
  switches (`--yes`, `--no-git`, `--skip-git`, etc.) where a tool offers them.
- If a command has no non-interactive form, redirect its input from nothing
  (`some-cmd < /dev/null`) rather than letting it wait on stdin.

## Deployable UI — ship gate

The creator is in Studio. They have **no terminal** and cannot run npm, yarn, vite,
or compact. Do not tell them to build locally, check `package.json`, or “re-run
Deploy after you build”. You run install and the UI build. Do not stop with a
“What to check” list. Cloud `NODE_ENV=production` skips Vite if it is only a
devDependency — install with `--production=false` / `--include=dev`.

A browser dApp is **not done** until `vite build` (or `npm run build`) succeeds with
`base: './'` and exactly one `dist/index.html`. Say that `dist/` path so they can
click Deploy dApp. Do not treat a missing `dist/` as complete. npm/yarn install alone
is not done. Do not idle after install: last command before stop is the UI
`npm run build`, and `test -f <ui>/dist/index.html` must succeed. Do not
`rm -rf node_modules` or delete `yarn.lock` / `package-lock.json` after
compact-init; a second install only adds `ui`/`api` workspaces.
