-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "seedWorldId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "humanNationId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "lastResolvedAt" DATETIME NOT NULL,
    "timeScale" REAL NOT NULL DEFAULT 1,
    "winnerNationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Nation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "controllerType" TEXT NOT NULL,
    "capitalProvinceId" TEXT NOT NULL,
    "isDefeated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Nation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProvinceState" (
    "sessionId" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "ownerNationId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,

    PRIMARY KEY ("sessionId", "provinceId"),
    CONSTRAINT "ProvinceState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProvinceState_ownerNationId_fkey" FOREIGN KEY ("ownerNationId") REFERENCES "Nation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NationResourceBalance" (
    "sessionId" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "resourceCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL,

    PRIMARY KEY ("sessionId", "nationId", "resourceCode"),
    CONSTRAINT "NationResourceBalance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NationResourceBalance_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "unitTypeCode" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "currentStrength" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Unit_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "unitTypeCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "queuedAt" DATETIME NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completesAt" DATETIME NOT NULL,
    "costSnapshotJson" TEXT NOT NULL,
    CONSTRAINT "ProductionQueue_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionQueue_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovementOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "fromProvinceId" TEXT NOT NULL,
    "toProvinceId" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "departsAt" DATETIME NOT NULL,
    "arrivesAt" DATETIME NOT NULL,
    "travelHours" REAL NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "MovementOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovementOrder_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovementOrder_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Nation_sessionId_idx" ON "Nation"("sessionId");

-- CreateIndex
CREATE INDEX "ProvinceState_ownerNationId_idx" ON "ProvinceState"("ownerNationId");

-- CreateIndex
CREATE INDEX "NationResourceBalance_nationId_idx" ON "NationResourceBalance"("nationId");

-- CreateIndex
CREATE INDEX "Unit_sessionId_idx" ON "Unit"("sessionId");

-- CreateIndex
CREATE INDEX "Unit_nationId_idx" ON "Unit"("nationId");

-- CreateIndex
CREATE INDEX "Unit_provinceId_idx" ON "Unit"("provinceId");

-- CreateIndex
CREATE INDEX "ProductionQueue_sessionId_idx" ON "ProductionQueue"("sessionId");

-- CreateIndex
CREATE INDEX "ProductionQueue_nationId_idx" ON "ProductionQueue"("nationId");

-- CreateIndex
CREATE INDEX "ProductionQueue_provinceId_idx" ON "ProductionQueue"("provinceId");

-- CreateIndex
CREATE INDEX "MovementOrder_sessionId_idx" ON "MovementOrder"("sessionId");

-- CreateIndex
CREATE INDEX "MovementOrder_unitId_idx" ON "MovementOrder"("unitId");

-- CreateIndex
CREATE INDEX "MovementOrder_nationId_idx" ON "MovementOrder"("nationId");
