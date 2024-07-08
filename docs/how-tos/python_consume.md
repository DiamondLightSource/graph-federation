# Python Consumer

## Preface 

This guide will explain how to fetch data from a GraphQL endpoint and map the response to a 
Pydantic model. 
We will cover: 

- Defining a Pydantic model in [Define the Pydantic Model](#define-the-pydantic-model)
- Fetching the data from GraphQL API in [Fetch Data from GraphQL API](#fetch-data-from-graphql-api)
- Mapping the response to the Pydantic model in [Map Response Pydantic Model](#map-response-to-pydantic-model)

!!! note "Alternative Options"

    You may want to investigate the following libraries depending on your specific needs:

      - [`gql`](https://github.com/graphql-python/gql) if you require support for subscriptions
      - [`sgqlc`](https://github.com/profusion/sgqlc) for typed code generation
      - [`ariadne-codegen`](https://github.com/mirumee/ariadne-codegen) for `pydantic` compatible code generation

## Dependencies 

This guide will utilize the following dependencies:

- `requests` to send HTTP request to the GraphQL endpoint
- `pydantic` for validating and parsing the fetched data

## Define the Pydantic Model

??? tip "More about Pydantic" 

    Pydantic is a data validation and parsing library in Python. It provides a efficient way to 
    validate and parse data into Python objects. We can use pydantic models to define the structure and type
    of data we intend to fetch from the endpoint. It automatically validates the input data based on 
    the defined type annotations. If the data does not match the expected types, Pydantic raises errors 
    ensuring the integrity of the data. 

To create a Pydantic model, we define a class with Pydantic's `BaseModel` class as the base class. 
We can define a `Person` class with the attributes we intend to fetch from the endpoint. 

!!! example "Define Pydantic Model"

    ```python
    from pydantic import BaseModel, ConfigDict

    class Person(BaseModel):
        model_config = ConfigDict(strict=True)
        id: int
        first_name: str
        last_name: str    

    ```
`model_config` is a way to configure model-level settings using a structured approach.
`ConfigDict` allows for specifying configuration options in a more readable and organized manner.

`strict=True` This setting ensures strict type validation, meaning that types must match exactly as defined in the model.

!!! info

    Refer to the [Graphql Schemas and Types](https://graphql.org/learn/schema) to learn more about the GraphQL schema and API structure

## Fetch Data From GraphQL API

To fetch data from a GraphQL API, we use the `requests` library to send a POST request with a GraphQL query.
We specify the GraphQL query as a string. 

!!! example "Fetch Data"

    ```python
    import requests

    url = 'http://127.0.0.1:8000/graphql'
    graphql_query = """
        query {
            person {
                id,
                firstName,
                lastName,
            }
        }
    """

    response = requests.post(url, json={'query': graphql_query})

    ```
## Map Response to Pydantic Model

We can now map the json response we got from the endpoint to a Pydantic model by  using Pydantics `model_validate_json()` method

!!! example "Define Pydantic Model"

    ```python
    response_data = response.json()

    # Extract the person data from the response
    person_data = response_data['data']['person']
    
    # Map the GraphQL response fields to the Pydantic model fields
    person = Person.model_validate_json(person_data)

    ```

If the [Python graphQL service](https://diamondlightsource.github.io/graph-federation/how-tos/python_service/) is running, `person` 
should output: 

`id=1 first_name='foo' last_name='bar'`
