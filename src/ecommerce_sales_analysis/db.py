from sqlalchemy import create_engine, text

from ecommerce_sales_analysis.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    # connect_args={"sslmode": "require"}
)


def test_connection():
    """
    Simple function to verify connectivity.
    """
    try:
        with engine.connect() as connection:
            # Execute a simple query
            result = connection.execute(text("SELECT 1"))
            print("✅ Connection successful!")
            print(f"   Database: {settings.DB_NAME}")
            print(f"   Host: {settings.DB_HOST}")
    except Exception as e:
        print("❌ Connection failed")
        print(e)


if __name__ == "__main__":
    test_connection()
