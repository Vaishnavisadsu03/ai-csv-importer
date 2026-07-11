from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")  # or put your key here
)

response = client.responses.create(
    model="gpt-4o-mini",
    input="Hello, explain AI in simple words."
)

print(response.output_text)