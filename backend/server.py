from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging  # noqa: E402
import os  # noqa: E402

from fastapi import APIRouter, FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from lib.db import client  # noqa: E402
from routers import admin, auth, documents, orders, reports  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    client.close()


app = FastAPI(lifespan=lifespan, title="Title Search Services API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Title Search Services API", "status": "ok"}


api_router.include_router(auth.router)
api_router.include_router(orders.router)
api_router.include_router(documents.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Must remain the last statement.
app.include_router(api_router)
