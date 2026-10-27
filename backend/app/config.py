from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_db_name: str = "invoicechat"
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()