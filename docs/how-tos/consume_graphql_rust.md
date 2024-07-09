# Consume GraphQL API using Rust

## Preface

This guide will explain how to fetch data from a GraphQL endpoint using the `cynic` crate. 
We will cover:

- Introspecting the GraphQL endpoint and generating `schema.graphql`in [Introspect GraphQL](#introspect-graphql)
- Defining GraphQL Types that we want to query in [Type Definitions](#type-definitions)
- Executing GraphQL query in [GraphQL Query Execution](#graphql-query-execution)

## Dependencies

This guide will utilize the following dependencies: 

- `reqwest` to send HTTP request to the GraphQL endpoint with `blocking` and `json` features enabled.
- `tokio` for writing asynchronous program. 
- `cynic` to construct GraphQL queries with `http-reqwest` and `http-reqwest-blocking` features enabled.
- `cynic-introspection` for introspecting the GraphQL endpoint. 

`reqwest` provides a simple and ergonomic API for interacting with web services and APIs over HTTP and HTTPS protocols.
GraphQL operates over HTTP, where queries and mutations are sent as POST requests to a GraphQL endpoint.
`reqwest` provides a straightforward API for constructing and sending these POST requests to the specified endpoint.

`tokio` is a runtime for writing reliable, asynchronous, and concurrent applications in Rust.
It provides an asynchronous foundation that allows Rust programs to efficiently handle many concurrent tasks without needing to dedicate an OS thread to each.
It enables Rust programs to perform asynchronous I/O operations, such as network requests (HTTP, TCP, UDP), file I/O, and more.
This is crucial for building responsive and scalable applications that can handle multiple tasks concurrently without blocking.

`cynic` is designed to simplify working with GraphQL in Rust applications.
It provides tools for defining GraphQL schemas, constructing GraphQL queries, sending those queries to GraphQL servers, and parsing the responses into Rust data structures.
It allows us to define GraphQL queries as Rust structs, leveraging Rust's type system to ensure type safety and correctness at compile time.

`cynic-introspection` provides tools for performing GraphQL introspection queries.
Introspection is a feature of GraphQL that allows you to query the schema of a GraphQL service itself.
This means you can dynamically explore the types, fields, and directives available in a GraphQL API without needing prior knowledge of its schema structure.

```toml
[dependencies]
reqwest = { version = "0.12.5", features = ["blocking", "json"] }
tokio = { version = "1.38.0", features = ["full"]}
cynic = { version = "3.7.3", features = ["http-reqwest"] }

[build-dependencies]
reqwest = { version = "0.12.5", features = ["blocking"] }
tokio = { version = "1.38.0" }
cynic = { version = "3.7.3", features = ["http-reqwest-blocking"] }
cynic-introspection = "3.7.3"
```

## Introspect GraphQL 

We use `build.rs` for performing GraphQL Introspection and generating `schema.graphql` based on the instrospection results.
When we build our Rust project (cargo build or cargo run), the `build.rs` file is executed before compiling the main Rust code (src/main.rs or src/lib.rs).
This script generates the `schema.graphql` file dynamically based on the GraphQL schema introspection results retrieved from http://127.0.0.1:8000/graphql.
The generated `schema.graphql` file can then be used for GraphQL query construction, validation, and other GraphQL-related operations.

!!! example "Imports"

    ```rust
    use cynic::{QueryBuilder, http::ReqwestBlockingExt};
    use cynic_introspection::IntrospectionQuery;
    use std::fs::File;
    use std::io::Write;
    ```
`cynic::{QueryBuilder, http::ReqwestBlockingExt}` Imports necessary traits and extensions from the cynic crate, which are used for building GraphQL queries and making HTTP requests (specifically using reqwest).

`cynic_introspection::IntrospectionQuery` Imports the `IntrospectionQuery` type from `cynic_introspection` crate, which is used to perform GraphQL schema introspection.

`std::fs::File and std::io::Write` Standard Rust modules for working with files and writing data to them.

We send a POST request to http://127.0.0.1:8000/graphql to execute a GraphQL introspection query.
`run_graphql` method executes the introspection query synchronously (blocking). We then convert the result into sdl (Schema Definition Language)
and save as `schema.graphql` file.

!!! example "Main function"
    ```rust
    fn main() {
        let introspection_data = reqwest::blocking::Client::new()
                .post("http://127.0.0.1:8000/graphql")
                .run_graphql(IntrospectionQuery::build(()))
                .unwrap()
                .data
                .unwrap();

        let schema = introspection_data.into_schema().unwrap().to_sdl();
        let mut file = File::create("schema.graphql").unwrap();
        file.write_all(schema.as_bytes()).unwrap();
    }
    ```

This should generate the following `schema.graphql` file: 

```graphql
type Person {
id: Int!
firstName: String!
lastName: String!
preferredName: String
pet: Pet!
}

type Pet {
id: Int!
ownerId: Int!
}

type Query {
person: Person!
_service: _Service!
}

type _Service {
sdl: String
}
```

!!! info

    Refer to the [Introspecting an API](https://cynic-rs.dev/schemas/introspection) to learn more about the GraphQL API introspection

## Type Definitions

!!! example "Import and Module Definition"

    ```rust
    use cynic::{http::ReqwestExt, QueryBuilder};

    mod schema {
        cynic::use_schema!("schema.graphql");
    }
    ```
`cynic::{http::ReqwestExt, QueryBuilder}` Imports necessary traits and types from the cynic crate. `ReqwestExt` extends `reqwest` functionality for GraphQL operations. QueryBuilder is used to construct GraphQL queries.

`mod schema` Defines a Rust module named schema and imports the GraphQL schema from `schema.graphql` using the `cynic::use_schema` macro. This macro generates Rust types based on the GraphQL schema.

Now we can define the GraphQL types, we want to query from the GraphQL endpoint, 

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

`Person`, `Pet`, `Query` structs annotated with cynic macros `cynic::QueryFragment` to indicate that they correspond to GraphQL types defined in `schema.graphql`.
`schema_path = "schema.graphql` macro Specifies that these Rust structs are generated based on the GraphQL schema defined in `schema.graphql`.

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

!!! example "Main function"

    ```rust
    #[tokio::main]
    async fn main() {
    match fetch_person().await {
        Ok(Some(person)) => println!("{:?}", person),
        Ok(None) => println!("No person data returned."),
        Err(e) => eprintln!("Error fetching person data: {}", e),
        }
    }
    ```
Running the main function should return the following response, 

`Person { id: 1, first_name: "foo", last_name: "bar", pet: Pet { id: 10, owner_id: 1 } }`
