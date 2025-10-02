PokeDAO API — OpenAPI Docs

- Docs UI: run the API and open `http://localhost:3000/docs`
- JSON spec: `http://localhost:3000/openapi.json`

How to use

- Start API locally: `pnpm --filter @pokedao/api dev`
- Export spec to file:
  - curl http://localhost:3000/openapi.json -o openapi.json

Notes

- The spec is generated from Fastify route registrations via `@fastify/swagger`.
- Add `schema` to routes to enrich docs (params, query, body, response).
