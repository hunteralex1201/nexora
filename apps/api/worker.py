import asyncio

from app.services.worker import run_worker

if __name__ == "__main__":
    asyncio.run(run_worker())
