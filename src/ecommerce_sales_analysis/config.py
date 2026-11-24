from dotenv import find_dotenv
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Define the variables you expect in your .env file
    # DB_USER: str
    # DB_PASSWORD: str
    # DB_HOST: str
    # DB_PORT: int
    # DB_NAME: str
    DB_NAME: str = "ecommerce_analysis.db"

    # The shared .env file also holds keys for other tools (for example the key for
    # the ask panel tests). Ignore them, so a validation error never prints them.
    model_config = SettingsConfigDict(
        env_file=find_dotenv(), env_file_encoding="utf-8", extra="ignore"
    )

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        """
        Constructs the SQLAlchemy URL automatically.
        Format: postgresql://user:password@host:port/dbname
        """
        # return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return f"sqlite:///{self.DB_NAME}"


settings = Settings()
