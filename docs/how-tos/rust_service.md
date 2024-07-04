# Rust Service

## Preface

This guide will explain how to develop a Rust service to serve data to the Graph.
We will cover:

- Setting up the HTTP/GraphQL Server in [Serving GraphQL Requests](#serving-graphql-requests)
- Creating GraphQL Objects and providing field resolvers in [Defining Objects](#defining-objects)
- Extending the graph using [Federation](#federated)
- Exporting the GraphQL schema for use in federation in [Schema Generation](#schema-generation)

## Dependencies

This guide will utilize the following dependencies:

- `axum` as the HTTP server
- `async-graphql` as graphql server library 
- `async-graphql-axum` for GraphQL request handling
- `tokio` as runtime for writing asynchronous rust program with macros and rt-multi-thread feature enabled

??? tip "More about async-graphql"

    `async-graphql` provides a high-performance server-side implementation of the GraphQL specification.
    It is designed to leverage Rust's asynchronous programming capabilities (using Tokio or async-std) to handle GraphQL queries efficiently and concurrently.


```toml
[dependencies]
async-graphql = "7.0.6"
async-graphql-axum = "7.0.6"
axum = "0.7.5"
tokio = { version = "1.38.0", features = ["macros", "rt-multi-thread"] }
```

## Serving GraphQL Requests

To handle GraphQL requests, we start by creating a server with a placeholder GraphQL schema. We use the `async-graphql-axum` crate, which provides integration between `async-graphql` and `axum`, to create a `graphql_handler`.

!!! example "GraphQL Request Handler"

    ```rust
    use async_graphql::{EmptyMutation, EmptySubscription, Object, Schema};
    use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
    use axum::{
        extract::Extension,
        routing::post,
        Router,
    };

    struct Query;

    #[tokio::main]
    async fn main() {
        let schema = Schema::build(Query, EmptyMutation, EmptySubscription).finish();

        let app = Router::new()
            .route("/graphql", post(graphql_handler))
            .layer(Extension(schema));

        let listener = tokio::net::TcpListener::bind("127.0.0.1:8000").await.unwrap();
        axum::serve(listener, app).await.unwrap();
    }

    async fn graphql_handler(
        schema: Extension<Schema<Query, EmptyMutation, EmptySubscription>>,
        req: GraphQLRequest,
    ) -> GraphQLResponse {
        schema.execute(req.into_inner()).await.into()
    }
    ```
!!! warning

    This is not a working code. `schema` throws an error without defining the Objects which we do it in the next section.

`GraphQLRequest` handles incoming GraphQL requests. It wraps the raw HTTP request
data and converts it into a form that can be processed by async-graphql.

`GraphQLResponse` wraps the results of executing a GraphQL query. It ensures
that the response is correctly formatted as a valid HTTP response that Axum can 
send back to the client.

## Defining Objects

!!! info

    Refer to [Async-graphql Book SimpleObject](https://async-graphql.github.io/async-graphql/en/define_simple_object.html)
    for a full explanation of how to implement various objects and resolvers.

An `Object` can be defined by using the `Object` macro from `async-graphql` crate. A GraphQL object must have
a resolver defined for each field in its `impl`.

We can use the `SimpleObject` macro from `async-graphql` to map all the fields of a struct to a GraphQL object.

```rust
use async_graphql::SimpleObject;

#[derive(SimpleObject)]
struct Person {
    id: u32, 
    first_name: String, 
    last_name: String, 
    preferred_name: Optional<String>,
}
```
We can write a resolver for the `Person`. A resolver function resolvers the values for all the fields a GraphQL object.

!!! example "Defind Object and a Resolver"

    ```rust
    use async_graphql::Object;
    struct Query;

    #[Object]
    impl Query {
        async fn person(&self) -> Person {
            Person {
                id: 1, 
                first_name: "foo".to_string(), 
                last_name: "bar".to_string(),
                preferred_name: None,
            }
        }
    }
    ```
Putting everything together, we should be able to run the follwing code, 

!!! example "Simple GraphQL service to provide a Person information"

    ```rust
    use async_graphql::{Context, EmptyMutation, EmptySubscription, Object, Schema, SimpleObject};
    use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
    use axum::{
        extract::Extension,
        routing::post,
        Router,
    };

    struct Query;

    #[Object]
    impl Query {
        async fn person(&self) -> Person {
            Person {
                id: 1, 
                first_name: "foo".to_string(), 
                last_name: "bar".to_string(),
                preferred_name: None,
            }
        }
    }

    #[derive(SimpleObject)]
    struct Person {
        id: u32, 
        first_name: String, 
        last_name: String, 
        preferred_name: Option<String>,
    }

    #[tokio::main]
    async fn main() {
        let schema = Schema::build(Query, EmptyMutation, EmptySubscription).finish();

        let app = Router::new()
            .route("/graphql", post(graphql_handler))
            .layer(Extension(schema));

        let listener = tokio::net::TcpListener::bind("127.0.0.1:8000").await.unwrap();
        axum::serve(listener, app).await.unwrap();
    }

    async fn graphql_handler(
        schema: Extension<Schema<Query, EmptyMutation, EmptySubscription>>,
        req: GraphQLRequest,
    ) -> GraphQLResponse {
        schema.execute(req.into_inner()).await.into()
    }
    ```
When we send request to the endpoint `curl -X POST -H "Content-Type: application/json" -d '{"query":"{ person {id, firstName, lastName, preferredName} }"}' http://127.0.0.1:8000/graphql` we should get the following response
```json
{
    "data":{
        "person":{
            "id":1,
            "firstName":"foo",
            "lastName":"bar",
            "preferredName":null
            }
        }
}
```

### Related

Most of the fields of a GraphQL object directly return the value of the field,
but sometimes the the fields are calculated or resolved by a different resolver.
In such cases, we can use the `ComplexObject` macro to write a user defined resolver.
This can be useful when we want to resolve related Objects. 
We need to use `complex` macro on `Person` struct for the `ComplexObject` macro to take effect.

!!! example "Related Objects"

    ```rust
    #[derive(SimpleObject)]
    #[graphql(complex)]
    struct Person {
        id: u32, 
        first_name: String, 
        last_name: String, 
        preferred_name: Option<String>,
    }

    #[derive(SimpleObject)]
    struct Pet{
        id: u32, 
        owner_id: u32,
    }

    #[ComplexObject]   
    impl Person{
        async fn pet(&self) -> Pet {
            Pet {
                id: 10, 
                owner_id: 1
            }
        }
    }
    ```

Now the `Person` object should have a `pet` field that resolvers a `Pet` object. When we send request to the endpoint, 
`curl -X POST -H "Content-Type: application/json" -d '{"query":"{ person {id, pet {id}} }"}' http://127.0.0.1:8000/graphql`
we should get the following response
```json
{
    "data":{
        "person":{
            "id":1,
            "pet":{"id":10}
            }
        }
}
```

## Federated
!!! info

    Refer to [Async-graphql Book Apollo Federation](https://async-graphql.github.io/async-graphql/en/apollo_federation.html) for a full explanation on federation using rust. 

To enable federation support we can the `schema.enable_federation()` method.

!!! example "Enable federation support"

    ```rust
    let schema = Schema::build(Query, EmptyMutation, EmptySubscription)
        .enable_federation()
        .finish();
    ```

We can extends the fields of an Object from another service/subgraph using Entities and @key. 

!!! info

    Refer to [Introduction to Entities](https://www.apollographql.com/docs/federation/entities/) for a full explanation on entities. 

!!! example "Extending fields in Pet Object from another service/subgraph"

    ```rust

    #[derive(SimpleObject)]
    struct Pet{
        id: u32, 
    }

    struct Query;

    #[Object]
    impl Query {
        #[graphql(entity)]
        async fn reference_resolver(&self, id: u32) -> Pet {
            Pet { id }
        }
    }

    ```

!!! info

    The `reference_resolver` function is not visible for the user consuming the API, it's a way of informing the graphql
    router/gateway that this subgraph can resolve the `id` field for the `Pet` object using the `id` as the key. 

Now we can extend fields in `Pet` object using the `ComplexObject` macro.
We need to use `complex` macro on `Pet` struct for the `ComplexObject` macro to take effect.

!!! example "Add fields to Pet object"

    ```rust
    #[derive(SimpleObject)]
    #[graphql(complex)]
    struct Pet{
        id: u32, 
    }

    #[derive(SimpleObject)]
    struct Toy{
        id: u32, 
        name: String,
    }

    struct Query;

    #[Object]
    impl Query {
        #[graphql(entity)]
        async fn reference_resolver(&self, id: u32) -> Pet {
            Pet { id }
        }

    }

    #[ComplexObject]   
    impl Pet{
        async fn toys(&self) -> Toy {
            Toy {id, name}
        }
    }
    ```
## Schema Generation

We can generate schema using `schema.sdl_with_options()` method. To enable federation declaratives we should
pass `SDLExportOptions::new().federation()` as an argument to the method. 

!!! example "Generate Schema with federation declaratives"

    ```rust
    use async_graphql::SDLExportOptions;
    #[tokio::main]
    async fn main() {
        let schema = Schema::build(Query, EmptyMutation, EmptySubscription)
            .enable_federation()
            .finish();

        let schema_string = schema.sdl_with_options(SDLExportOptions::new().federation());
        println!("{}", schema_string)
    }

    ```
