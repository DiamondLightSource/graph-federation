# Rust Consumer

## Preface

This guide will explain how to fetch data from a GraphQL endpoint using the `cynic` crate. 
We will cover:

- Defining GraphQL Types that we want to query in [Type Definitions](#type-definitions)
- Executing GraphQL query in [GraphQL Query Execution](#graphql-query-execution)

## Dependencies

This guide will utilize the following dependencies: 

- `reqwest` to send HTTP request to the GraphQL endpoint with `blocking` and `json` features enabled.
- `tokio` for writing asynchronous program. 
- `cynic` to construct GraphQL queries with `http-reqwest` and `http-reqwest-blocking` features enabled.

??? tip "More about cynic"

    `cynic` provides tools for defining GraphQL schemas, constructing GraphQL queries, sending those queries to GraphQL servers, and parsing the responses into Rust data structures.
    It allows us to define GraphQL queries as Rust structs, leveraging Rust's type system to ensure type safety and correctness at compile time.


```toml
[dependencies]
reqwest = { version = "0.12.5", features = ["blocking", "json"] }
tokio = { version = "1.38.0", features = ["full"]}
cynic = { version = "3.7.3", features = ["http-reqwest"] }
```

## Type Definitions

!!! example "Import and Module Definition"

    ```rust
    use cynic::{http::ReqwestExt, QueryBuilder};

    mod schema {
        cynic::use_schema!("schema.graphql");
    }
    ```
`cynic::{http::ReqwestExt, QueryBuilder}` Imports necessary traits and types from the cynic crate. `ReqwestExt` extends `reqwest` functionality for GraphQL operations. QueryBuilder is used to construct GraphQL queries.

We will use the `cynic::use_schema` macro to generate a set of Rust types based on the GraphQL schema. Typically, these should be constrained to their own module using `mod schema {}` to ensure they do not interfere with our code.

Curl the GraphQL endpoint to get the schema. Refer to [GraphQL Introspection](https://graphql.org/learn/introspection/) to learn more about introspection

Now we can define the GraphQL types, we want to query from the GraphQL endpoint, 

`schema_path = "schema.graphql` macro Specifies that these Rust structs are generated based on the GraphQL schema defined in `schema.graphql`.
`Person`, `Pet`, `Query` structs annotated with cynic macros `cynic::QueryFragment` to indicate that they correspond to GraphQL types defined in `schema.graphql`.
It implements the trait by the same name.

!!! example "GraphQL Types"

    ```rust
    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(schema_path = "schema.graphql")]
    struct Person {
        id: i32,
        #[cynic(rename = "firstName")]
        first_name: String,
        #[cynic(rename = "lastName")]
        last_name: String,
        pet: Pet, 
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(schema_path = "schema.graphql")]
    struct Pet {
        id: i32,
        #[cynic(rename = "ownerId")]
        owner_id: i32,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(schema_path = "schema.graphql")]
    struct Query {
        person: Option<Person>,
    }
    ```


## GraphQL Query Execution

Now we have the GraphQL types defined, we can define a function to the send a POST request to the endpoint with the GraphQL query to fetch the `Person` data. 


!!! example "Fetch Person data"

    ```rust
    async fn fetch_person() -> Result<Option<Person>, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let operation = Query::build(());

        let response: cynic::GraphQlResponse<Query> = client
            .post("http://127.0.0.1:8000/graphql")
            .run_graphql(operation)
            .await?;

        Ok(response.data.and_then(|data| data.person))
    }
    ```
`reqwest::Client::new()` Creates a new reqwest HTTP client.
`Query::build(())` Constructs a GraphQL query using QueryBuilder.
`client.post(...).run_graphql(operation).await?` Sends a POST request to http://127.0.0.1:8000/graphql with the GraphQL query (operation), awaits the response. 
`Ok(response.data.and_then(|data| data.person))` Extracts and returns the person data from the GraphQL response.

Running the `fetch_person()` function should return the following response, 

```bash 
Person { id: 1, first_name: "foo", last_name: "bar", pet: Pet { id: 10, owner_id: 1 } }
```
