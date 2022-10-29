# Fetch GitHub Organization contributors from all or selected repositories for particular year

### Create fine-grained personal access token (https://github.com/settings/tokens)

Permissions you'll need:
- Contents (Repository contents, commits, branches, downloads, releases, and merges.): Read-only

### In order to run:

```bash
# copy environment file & configure needed settings
cp .env.template .env

# install deps
yarn --immutable

# start fetching
yarn start
```

### Output
File(s).txt with list of GitHub usernames who made any commit any of (all or provided) repositories in organization
