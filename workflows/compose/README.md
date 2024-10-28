# Compose Supergraph Schema

This workflow may be used to test that a new or updated Subgraph Schema is composable with the federated Supergraph described in the `supergraph-config.yaml` of this repository.

## Usage

### Inputs

```yaml
- uses: diamondlightsource/graph-federation/workflows/compose@v1
  with:
    # A unique name given to the subgraph.
    # Required.
    name:

    # The public-facing URL of the subgraph.
    # Required.
    routing-url:

    # The name of an artifact from this workflow run containing the subgraph schema.
    # Required.
    subgraph-schema-artifact:

    # The name of the subgraph schema file within the artifact.
    # Required.
    subgraph-schema-filename:

    # The name of the artifact to be created containing the supergraph schema.
    # Optional. Default is 'supergraph'
    supergraph-schema-artifact:

    # The name of the supergraph schema file within the created artifact.
    # Optional. Default is 'supergraph.graphql'
    supergraph-schema-filename:
```

### Outputs

| Name                           | Description                                              | Example                                                                   |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| supergraph-schema-artifact-id  | The id of the artifact containing the supergraph schema  | 1234                                                                      |
| supergraph-schema-artifact-url | The url of the artifact containing the supergraph schema | <https://github.com/example-org/example-repo/actions/runs/1/artifacts/1234> |

### Example

```yaml
steps:
  - name: Create Test Subgraph schema
    run: >
      echo "
        schema {
          query: Query
        }
        type Query {
          _empty: String
        }
      " > test-schema.graphql

  - name: Upload Test Subgraph schema
    uses: actions/upload-artifact@v4.4.3
    with:
      name: test-schema
      path: test-schema.graphql

  - name: Compose Supergraph
    uses: diamondlightsource/graph-federation/workflows/compose@v1
    with:
      name: test
      routing-url: https://example.com/graphql
      subgraph-schema-artifact: test-schema
      subgraph-schema-filename: test-schema.graphql
```
