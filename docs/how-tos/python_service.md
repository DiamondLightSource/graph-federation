# Python Service

## Preface

This guide will explain how to develop a Python service to serve data to the Graph.
We will cover:

- Setting up the HTTP/GraphQL Server in [Serving GraphQL Requests](#serving-graphql-requests)
- Creating GraphQL Objects and providing field resolvers in [Defining Objects](#defining-objects)
- Exporting the GraphQL schema for use in federation in [Schema Generation](#schema-generation)

## Dependencies

This guide will utilize the following dependencies:

- `uvicorn` as the HTTP server
- `starlette` as the HTTP framework
- `strawberry-graphql` with the `asgi` feature for GraphQL request handling

## Serving GraphQL Requests

To begin we will create a placeholder GraphQL `strawberry.federation.Schema` with an empty list of `types` and with `enable_federation_2` set to `true`.
From this we will create a `strawberry.asgi.GraphQL` request handler, which will process requests for a given route and generate responses.

To route and handle HTTP traffic we will create a `starlette.application.Starlette` app.
We will call `add_route` on the app to register a HTTP route with the aforementioned `GraphQL` handler.
This will in turn be served using a `uvicorn` server with `uvicorn.run`.

!!! example "GraphQL Request Handler"

    ```python
    import uvicorn
    from starlette.application import Starlette
    from strawberry.asgi import GraphQL
    from strawberry.federation import Schema

    SCHEMA = Schema(types=[], enable_federation_2=True)

    if __name__ == "__main__":
        app = Starlette()
        app.add_route("/graphql", GraphQL(SCHEMA))
        uvicorn.run(app)
    ```

!!! tip

    The `OpenTelemetryMiddleware` from `opentelemetry-instrumentation-asgi` can be added to the `Starlette` app with `add_middleware` to provide route level tracing and metrics.

## Defining Objects

!!! info

    See the [Strawberry schema basics docs](https://strawberry.rocks/docs/general/schema-basics) for a full explanation of how to implement various objects and resolvers.

Strawberry creates GraphQL Objects from Python classes, hence creating a GraphQL Object is as simple as creating a Python class and tagging it with `@strawberry.type`.
Methods may be used to provide derived fields or supply related objects as described in the [Standalone Objects](#standalone) and [Related Objects](#related) sections.
Objects from other services may be extended as described in the [Federated Objects](#federated) section.

### Standalone

!!! warning

    Standalone object creation is only shown for completeness, it is strongly recommended to define your object in relation to an existing object in the Graph where possible.

A standalone object can be created simply by defining a `class` with the `@strawberry.type` tag with various properties.
These properties must be given [type hints](https://docs.python.org/3/library/typing.html), which will be used to inform (de)serialization of the object and provide API guarantees.
The `strawberry.Private` type can be used to hide a given property from the API.

Additionally, you may define resolvers which are used to compute a field in the GraphQL response, according to some input.
Such resolvers can be defined as methods on the class with the `@strawberry.field` tag which return a known type.
They may take additonal input arguments which modify the way they operate.

!!! example "Standalone Object"

    ```python
    import strawberry
    from typing import Optional
    from uuid import UUID

    PEOPLE: dict[UUID, Person] = populate_people()

    @strawberry.type
    class Person:
        id: strawberry.Private[UUID]
        first_name: str
        last_name: str
        preferred_name: Optional[str]

        @strawberry.field
        def name(self) -> str:
            return self.preferred_name if self.preferred_name is not None else f"{self.first_name} {self.last_name}"
    ```

### Related

Using resolvers, as with derived properties in [Standalone Objects](#standalone), we can define related objects.
These are simply methods with the `@strawberry.field` tag which return another object `class`.
Similarly they may take additional arguments, which are often used for filters or pagination parameters.

!!! example "Related Object"

    ```python
    import strawberry
    from uuid import UUID

    PEOPLE: dict[UUID, Person] = populate_people()
    PETS: dict[UUID, Pet] = populate_pets()

    @strawberry.type
    class Person:
        id: strawberry.Private[UUID]

        @strawberry.field
        def pets(self) -> list[Pet]:
            return [pet for pet in PETS if pet.owner_id == self.id]

    @strawberry.type
    class Pet:
        id: strawberry.Private[UUID]
        owner_id: strawberry.Private[UUID]

        @strawberry.field
        def owner(self) -> Person:
            return PEOPLE[self.owner_id]
    ```

### Federated

!!! info

    See [the Strawberry federation docs](https://strawberry.rocks/docs/guides/federation) for a full explanation of how various federation mechanisms can be implemented.

Objects from other services in the federated Graph can be referenced by creating a `class` tagged with `@strawberry.federation.type(keys=...)` where `keys` is a list of names of primary keys for the type.
If your `class` contains parameters which do not come from the `keys` then you must define a `resolve_reference` `@classmethod` which produces an instance of your `class` when given the `keys`.

Once a federated Object is defined you can implement resolvers for it as with a [Standalone Object](#standalone) by defining a method with the `@strawberry.field` tag.

!!! example "Federated Object"

    ```python
    import strawberry
    from uuid import UUID

    @strawberry.federation.type(keys=["id"])
    class Pet:
        id: strawberry.Private[UUID]
        toy_ids: strawberry.Private[list[UUID]]

        @classmethod
        def resolve_reference(cls, id: UUID) -> Pet:
            return Pet(id=id, toy_ids=find_toys())

        @strawberry.field
        def toys(self) -> list[Toy]:
            [Toy(toy_id) for toy_id in self.toy_ids]

    @strawberry.type
    class Toy:
        id: strawberry.Private[UUID]
        name: str
    ```

## Schema Generation

Schema generation can be performed using the `strawberry.printer.print_schema` method.
This will generate a string in the [GraphQL Schema Language](https://graphql.org/learn/schema/#type-language) format, which can be used to perform schema composition.

!!! tip

    You will likely want to create a program entrypoint or CLI option which writes the schema to a file.

!!! example "Schema Generation"
    
    ```python
    from strawberry.federation import Schema
    from strawberry.printer import print_schema

    SCHEMA = Schema(types=[], enable_federation_2=True)

    if __name__ == "__main__":
        sdl = print_schema(SCHEMA)
        print(sdl)
    ```
