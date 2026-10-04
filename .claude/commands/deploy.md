Deploy the current project to the VPS. Arguments: $ARGUMENTS (e.g. `root@1.2.3.4`).
1. Run `npm run check` and `npm run test:ui` first; stop if anything fails.
2. Build a zip without data/, media/, .env, node_modules.
3. `scp` it to the server and run `nooi-update /root/nooi-server.zip` there (auto-rollback on failure). First install? use `bash deploy/install.sh <domain> <email>`.
4. Check `curl -fsS https://<domain>/v1/health` and `journalctl -u nooi -n 50`.
Never print or copy the server's .env. Report the result in English with Arabic under each line.
