## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

**CRITICAL RULE:** Every time you modify code (add a feature, fix a bug, refactor, add a module, change a data model, update dependencies, or modify any behavior), you MUST update the project skill AND the relevant documentation files. This is not optional.

### Files to keep in sync

| File | When to update |
|---|---|
| **`.agents/skills/cptp-scoring/SKILL.md`** | **ALWAYS** — this skill is the AI's reference for the project |
| `docs/ARCHITECTURE.md` | Adding/removing modules, changing data flow, new architectural patterns |
| `docs/TECHNICAL.md` | Changing module behavior, scoring rules, DB schema, deps, build process |
| `docs/MASTER-REFERENCE.md` | Changing business rules, adding modalities, significant new features |

### What to update

- **New module or view file** → add it to the module map and file structure in the skill + all 3 docs
- **Changed DB schema or migration** → update data model tables and migration history in TECHNICAL.md and MASTER-REFERENCE.md
- **Changed scoring logic** → update scoring rules tables in TECHNICAL.md and MASTER-REFERENCE.md
- **New feature or behavior** → update relevant data flow diagrams and descriptions in ARCHITECTURE.md
- **Changed dependencies or build** → update technology stack in TECHNICAL.md
- **Changed auth/RBAC** → update auth section in TECHNICAL.md and ARCHITECTURE.md
- **Changed sync logic** → update cloud sync flow in ARCHITECTURE.md

### References

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
