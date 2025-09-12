# PokeDAO Research Folder

This folder contains research scripts and data collection tools that have been organized and made compatible with the canonical schema.

## Structure

- `consolidated/extractors/` - Data extraction scripts
- `consolidated/analyzers/` - Data analysis scripts  
- `consolidated/integrations/` - Integration and harvesting scripts
- `consolidated/utilities/` - Utility scripts
- `consolidated/canonical-adapter.js` - Canonical schema adapter

## Usage

All scripts should use the canonical schema adapter:

```javascript
import { PrismaClient, normalizeCardData, getCanonicalPrisma } from './canonical-adapter.js';
```

## Canonical Schema

The single source of truth is: `/api/prisma/schema.prisma`

All data should be normalized to this schema format before storage.
