from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    mongodb_uri: str
    mongodb_db_name: str = "invoicechat"

    # AI
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"

    # Payments: "fake" (no account needed), "braintree" or "paypal"
    payment_provider: str = "fake"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    paypal_webhook_id: str = ""

    # Braintree (always the sandbox: see services/braintree_provider.py)
    braintree_merchant_id: str = ""
    braintree_public_key: str = ""
    braintree_private_key: str = ""
    # Each Braintree merchant account has one currency, e.g. "USD:my_usd_account,EUR:my_eur_account"
    braintree_merchant_accounts: str = ""
    # Shows a clearly labelled test button that uses Braintree's simulated PayPal payment
    braintree_simulated_paypal: bool = False

    # Where the React app lives. Client pay links are built from this.
    frontend_url: str = "http://localhost:5173"

    # Frontend URLs allowed to call this API (comma-separated)
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def braintree_account_map(self) -> dict[str, str]:
        """Turns "USD:a,EUR:b" into {"USD": "a", "EUR": "b"}."""
        accounts = {}
        for pair in self.braintree_merchant_accounts.split(","):
            currency, _, account = pair.partition(":")
            if currency.strip() and account.strip():
                accounts[currency.strip().upper()] = account.strip()
        return accounts


settings = Settings()