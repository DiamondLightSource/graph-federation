# Terminology

### Schema

A GraphQL schema is an artifact describing the API provided by a given GraphQL endpoint.
This is likely to contain a set of [Queries](https://spec.graphql.org/October2021/#sec-Query), [Mutations](https://spec.graphql.org/October2021/#sec-Mutation) and [Subscriptions](https://spec.graphql.org/October2021/#sec-Subscription), and a description of the [Objects](https://spec.graphql.org/October2021/#sec-Objects) which they return.


### Subgraph Schema
A Subgraph is the [Schema](#schema) of an individual service. These may be stitched together to form a [Supergraph](#supergraph).

### Supergraph Schema

A Supergraph is simply a GraphQL [Schema](#schema) which has been stitched together from various [Subgraphs](#subgraph).

