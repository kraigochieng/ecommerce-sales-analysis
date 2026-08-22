from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from ecommerce_sales_analysis.config import settings
from ecommerce_sales_analysis.db.models import Base

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    # connect_args={"sslmode": "require"}
)

Session = sessionmaker(bind=engine)


def create_tables():
    """
    Creates any tables defined in the models that don't already exist.
    Non-destructive: existing tables and their data are left untouched.
    """
    Base.metadata.create_all(engine)
    print("Tables created (existing tables/data untouched)")


def test_connection():
    """
    Verifies connectivity by dropping and recreating all modeled tables.
    Destructive: wipes any existing data in those tables. Use create_tables()
    instead if you just want to make sure the schema exists.
    """
    try:
        with engine.connect() as connection:
            Base.metadata.drop_all(engine)
            print("Dropped star schema")
            result = connection.execute(text("SELECT 1"))

            print("Connection successful!")
            print(f"Database: {settings.DB_NAME}")
            # print(f"Host: {settings.DB_HOST}")

            Base.metadata.create_all(engine)
            print("Created star schema")
    except Exception as e:
        print("❌ Connection failed")
        print(e)


if __name__ == "__main__":
    test_connection()
