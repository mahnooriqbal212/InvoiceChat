from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    mongodb_uri: str
    mongodb_db_name: str = "invoicechat"

    # AI
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    # Payments: "fake" (no account needed) or "paypal"
    payment_provider: str = "fake"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    paypal_webhook_id: str = ""

    # Frontend URLs allowed to call this API (comma-separated)
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()