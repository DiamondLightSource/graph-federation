# Data Gateway

A deployment of a GraphQL router, acting as the Data Gateway for Diamond Light Source.

## Docs

Docs can be found [on github pages](https://diamondlightsource.github.io/graph-federation/)

## Structure

- `supergraph-schema.yaml` & `schema/`: A description of how subgraph schemas and how they are composed to produce the supergraph schema.
- `apps.yaml` & `charts/apps/`: An [ArgoCD](https://argoproj.github.io/cd/) [App-of-Apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/#app-of-apps-pattern) used to deploy the other charts in various configurations
- `charts/graph`: A Helm chart used to deploy the [Apollo Router](https://www.apollographql.com/docs/router/)
- `charts/monitoring`: A Helm chart used to deploy [Prometheus](https://prometheus.io/) and [Jaeger](https://www.jaegertracing.io/) for observability
- `charts/supergraph`: A Helm chart used to deploy the supergraph schema
- `workflows/compose`: A [GitHub action](https://github.com/features/actions) used to perform schema composition
- `mkdocs.yaml` & `docs/`: User facing documentation, built with [mkdocs](https://www.mkdocs.org/)
