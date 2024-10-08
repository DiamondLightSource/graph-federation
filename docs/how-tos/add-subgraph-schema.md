# Add Subgraph Schema

## Preface

This guide will explain how to introduce or update the schema of a subgraph via a Pull Request to the [graph-federation](https://github.com/DiamondLightSource/graph-federation/) repository.
Code snippets will be given in the form of GitHub actions.

## Generate Subgraph Schema

To begin, we must generate the subgraph schema of our application.
How this is performed will differ depending on our chosen language and GraphQL library.
For instance;

- [`strawberry` (Python)](https://strawberry.rocks/) users can use`strawberry export-schema my_package:schema` as described in the [schema export docs](https://strawberry.rocks/docs/guides/schema-export).
- [`async-graphql` (Rust)](https://crates.io/crates/async-graphql) users should create a command which builds and exports the schema as described on the [SDL export page of the book](https://async-graphql.github.io/async-graphql/en/sdl_export.html).

Our CI job should checkout the source, setup the environment and generate the schema, as shown below.
It is useful to upload the schema as an artifact to allow download both in future workflow jobs and for review.

!!! example "GitHub Actions Schema Generation"

    ```yaml
    jobs:
      generate_schema:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout source
            uses: actions/checkout@v4.1.7

          - name: Setup Python
            uses: actions/setup-python@v5.2.0

          - name: Install (Dev) Dependencies
            run: pip install .[dev]
            
          - name: Generate Schema
            run: strawberry export-schema my_app:schema > schema.graphql

          - name: Upload Schema Artifact
            uses: actions/upload-artifact@v4.4.0
            with:
              name: graphql-schema
              path: schema.graphql
    ```

## Check Schema Validity

To check our schema is valid we will use the [Apollo Rover CLI](https://www.apollographql.com/docs/rover/).
We can retrieve the exisitng schema and configuration by cloning the [`graph-federation` repository](https://github.com/DiamondLightSource/graph-federation/) - in which we will find a `supergraph-config.yaml` file describing the federation and a number of schemas in the `schema/` directory.

Once cloned, we can add our subgraph definition to the `schema/` directory and a descriptor to the `supergraph-config.yaml`.
This should reside under the `subgraphs` key, be given a key which describes our service and should contain:

- A `routing_url` which points to the production instance of our service
- A `schema.file` which points to our subgraph schema in the `schema/` directory

We can now use the `Apollo Rover CLI` to compose the supergraph, as:

```bash
rover supergraph compose --config supergraph-config.yaml --elv2-license accept
```

!!! example "GitHub Actions Validity Checking"

    ```yaml
    jobs:
      federate:
        runs-on: ubuntu-latest
        needs: generate_schema
        steps:
          - name: Checkout Graph Federation source
            uses: actions/checkout@v4.1.7
            with:
              repository: DiamondLightSource/graph-federation

          - name: Download Schema Artifact
            uses: actions/download-artifact@v4.1.8
            with:
              name: graphql-schema
              path: schema

          - name: Add Subgraph workflows to Supergraph config
            run: >
              yq -i
              '
              .subgraphs.workflows={
                "routing_url":"https://workflows.diamond.ac.uk/graphql",
                "schema":{
                  "file":"schema/workflows.graphql"
                }
              }
              '
              supergraph-config.yaml

          - name: Install Rover CLI
            run: |
              curl -sSL https://rover.apollo.dev/nix/latest | sh
              echo "$HOME/.rover/bin" >> $GITHUB_PATH

          - name: Compose Supergraph Schema
            run: >
              rover supergraph compose
              --config supergraph-config.yaml
              --elv2-license=accept
              > supergraph.graphql
    ```

## Pull Request Generation

To update the deployed supergraph schema, we should create a Pull Request to the [`graph-federation` repository](https://github.com/DiamondLightSource/graph-federation/) with the desired subgraph schema and relevant configuration changes.

### GitHub Applications

A [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) can be created in order to act as a bot account capable of pushing to branches and creating Pull Requests from the GitHub actions of another repository.

!!! tip

    GitHub Apps can be requested in the [#github-requests slack channel](https://diamondlightsource.slack.com/archives/C06A18ZPP44).

!!! example "Full GitHub Actions Workflow"

    ```yaml
    name: Graph Proxy Schema

    on:
      push:
      pull_request:

    jobs:
      generate_schema:
        # Deduplicate jobs from pull requests and branch pushes within the same repo.
        if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name != github.repository
        runs-on: ubuntu-latest
        env:
          ARGO_SERVER_SCHEMA_URL: <https://raw.githubusercontent.com/argoproj/argo-workflows/main/api/jsonschema/schema.json>
        steps:
          - name: Checkout source
            uses: actions/checkout@v4.1.7

          - name: Install stable toolchain
            uses: actions-rust-lang/setup-rust-toolchain@v1.10.0

          - name: Cache Rust Build
            uses: Swatinem/rust-cache@v2.7.3

          - name: Generate Schema
            run: >
              cargo run
              schema
              --path workflows.graphql
            working-directory: graph-proxy

          - name: Upload Schema Artifact
            uses: actions/upload-artifact@v4.4.0
            with:
              name: graphql-schema
              path: ./graph-proxy/workflows.graphql

      federate:
        # Deduplicate jobs from pull requests and branch pushes within the same repo.
        if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name != github.repository
        runs-on: ubuntu-latest
        needs: generate_schema
        steps:
          - name: Create GitHub App Token
            id: app-token
            uses: actions/create-github-app-token@v1.11.0
            with:
              app-id: 1010045
              private-key: ${{ secrets.GRAPH_FEDERATOR }}
              repositories: graph-federation

          - name: Create GitHub App Committer String
            id: get-user-id
            run: echo "user-id=$(gh api "/users/${{ steps.app-token.outputs.app-slug }}[bot]" --jq .id)" >> "$GITHUB_OUTPUT"
            env:
              GH_TOKEN: ${{ steps.app-token.outputs.token }}

          - name: Checkout Graph Federation source
            uses: actions/checkout@v4.1.7
            with:
              repository: DiamondLightSource/graph-federation
              token: ${{ steps.app-token.outputs.token }}

          - name: Download Schema Artifact
            uses: actions/download-artifact@v4.1.8
            with:
              name: graphql-schema
              path: schema

          - name: Add Subgraph workflows to Supergraph config
            run: >
              yq -i
              '
              .subgraphs.workflows={
                "routing_url":"https://workflows.diamond.ac.uk/graphql",
                "schema":{
                  "file":"schema/workflows.graphql"
                }
              }
              '
              supergraph-config.yaml

          - name: Install Rover CLI
            run: |
              curl -sSL https://rover.apollo.dev/nix/latest | sh
              echo "$HOME/.rover/bin" >> $GITHUB_PATH

          - name: Compose Supergraph Schema
            run: >
              rover supergraph compose
              --config supergraph-config.yaml
              --elv2-license=accept
              > supergraph.graphql

          - name: Configure Git
            run: |
              git config user.name "${{ steps.app-token.outputs.app-slug }}[bot]"
              git config user.email "${{ steps.get-user-id.outputs.user-id }}+${{ steps.app-token.outputs.app-slug }}[bot]@users.noreply.github.com"

          - name: Create commit
            run: |
              git checkout -b workflows-${{ github.ref_name }}
              git add supergraph-config.yaml schema/workflows.graphql
              if ! git diff --staged --quiet --exit-code supergraph-config.yaml schema/workflows.graphql; then
                git commit -m "Update workflows schema to ${{ github.ref_name }}"
              fi

          - name: Create PR
            if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags')
            run: |
              git push origin workflows-${{ github.ref_name }}
              gh auth login --with-token <<< ${{ steps.app-token.outputs.token }}
              gh pr create \
                --title "chore: Update Workflows subgraph to ${{ github.ref_name }}" \
                --body "" \
                --head workflows-${{ github.ref_name }} \
                --base main
    ```
