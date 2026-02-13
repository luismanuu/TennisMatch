# Dependency Status and Monitoring

This document tracks the status of dependencies, including deprecated subdependencies and monitoring strategies.

## Deprecated Subdependencies

The following deprecated subdependencies (transitive dependencies) have been identified and addressed:

### 1. @koa/router@12.0.2
- **Status**: Deprecated (used by tailwind-config-viewer via @nuxt/ui)
- **Action**: Added npm override to force `@koa/router@^15.0.0` (latest version)
- **Note**: This package is a transitive dependency via tailwind-config-viewer. The override forces all packages to use v15+ which fixes security issues and deprecation warnings.

### 2. @types/parse-path@7.1.0
- **Status**: Deprecated (TypeScript types package)
- **Source**: Transitive dependency
- **Action**: Monitoring for parent package updates
- **Note**: This is a TypeScript types package (@types/*), not a runtime dependency. The deprecation warning is informational. No override needed as it doesn't affect runtime behavior. Will be resolved when parent packages update their type dependencies.

### 3. glob@7.2.3
- **Status**: Deprecated (versions < 9 are deprecated)
- **Latest Version**: 13.0.0
- **Source**: Used by multiple packages:
  - `fork-ts-checker-webpack-plugin` (via `@nuxt/typescript-build`)
  - `tinyglobby` (via `@nuxt/kit`, `@nuxt/test-utils`)
  - `fake-indexeddb` (via `@nuxt/test-utils`)
  - `fdir` (via `fast-glob`)
  - `ajv` (via `schema-utils`)
- **Action**: Added npm override to force `glob@^10.0.0`

### 4. inflight@1.0.6
- **Status**: Deprecated
- **Source**: Dependency of `glob@7.2.3`
- **Action**: Added npm override to force `inflight@^1.0.6` (latest version)

### 5. keygrip@1.1.0
- **Status**: Deprecated
- **Source**: `cookies@0.9.1` -> `koa@2.16.3` -> `@vercel/nft@1.3.0`
- **Action**: Added npm override to force `keygrip@^1.1.0` (latest version)

## npm Overrides

The following overrides have been added to `package.json` to force newer versions of deprecated packages:

```json
{
  "overrides": {
    "@koa/router": "^15.0.0",
    "glob": "^10.0.0",
    "inflight": "^1.0.6",
    "keygrip": "^1.1.0"
  }
}
```

**Note**: These overrides force all packages in the dependency tree to use the specified versions, which helps eliminate deprecated dependency warnings.

## Parent Package Status

### @nuxt/typescript-build@3.0.2
- **Status**: **REMOVED** - Deprecated for Nuxt 3+ (TypeScript is built-in)
- **Action**: Removed from package.json as it's not needed for Nuxt 4
- **Note**: Nuxt 4 has built-in TypeScript support, so this package is unnecessary

### @nuxt/test-utils@3.23.0
- **Current Version**: 3.23.0 (latest)
- **Previous Version**: 3.21.0
- **Status**: Updated to latest version
- **Action**: Updated from 3.21.0 to 3.23.0 for latest fixes and improvements
- **Note**: Uses packages with deprecated dependencies (glob@7.2.3), but override handles this

### @vercel/nft@1.3.0
- **Current Version**: 1.3.0 (via nitropack)
- **Status**: Uses deprecated keygrip via koa
- **Action**: Override applied via npm overrides

## Monitoring Strategy

### Automated Monitoring

1. **Dependabot** (GitHub)
   - Configured to check for dependency updates weekly
   - See `.github/dependabot.yml` for configuration

2. **npm audit**
   - Run regularly: `npm audit`
   - Fix vulnerabilities: `npm audit fix`

3. **npm outdated**
   - Check for outdated packages: `npm outdated`
   - Review and update as needed

### Manual Checks

1. **Monthly Review**
   - Check for updates to parent packages
   - Review deprecated dependency warnings
   - Update overrides if newer versions available

2. **Before Major Releases**
   - Full dependency audit
   - Update all packages to latest compatible versions
   - Test thoroughly after updates

## Resolution Steps

When new deprecated dependencies are found:

1. **Identify the source**: Use `npm ls <package>` to find which package depends on it
2. **Check for updates**: Check if parent package has updates that resolve the issue
3. **Add override if needed**: Add to `package.json` overrides section
4. **Test thoroughly**: Ensure application still works after override
5. **Document**: Update this file with the new deprecated dependency

## Verification

After applying fixes:

```bash
# Verify dependency tree
npm ls glob inflight keygrip

# Check for deprecated warnings
npm install

# Run tests to ensure nothing broke
npm test
```

## Notes

- Transitive dependencies cannot be directly controlled
- Some deprecated packages may require waiting for parent package updates
- Overrides should be used carefully as they can cause compatibility issues
- Always test after applying overrides or updating packages
