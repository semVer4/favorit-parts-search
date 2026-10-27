import { describe, expect, it } from "vitest";
import { normalizeBrands, normalizeOffers } from "./normalize.js";

const part = {
  goodsID: "part-1",
  brand: "MEYLE",
  number: "7160500039S",
  name: "Рычаг подвески",
  count: 99,
  price: 1,
  warehouses: [
    { id: "msk", code: "МСК", price: 1200, stock: 3 },
    { id: "spb", code: "СПБ", price: 1350, stock: 7 },
  ],
};

describe("normalizeBrands", () => {
  it("убирает пустые записи и повторяющихся производителей, сохраняя написание бренда", () => {
    expect(
      normalizeBrands([
        {},
        null,
        { brand: "" },
        { brand: "  MEYLE ", name: " Рычаг " },
        { brand: "meyle", name: "Другая деталь" },
        { brand: "FEBI", name: "Тяга" },
      ]),
    ).toEqual([
      { brand: "MEYLE", name: "Рычаг" },
      { brand: "FEBI", name: "Тяга" },
    ]);
  });

  it("обрабатывает документированный ответ с пустым объектом", () => {
    expect(normalizeBrands([{}])).toEqual([]);
  });
});

describe("normalizeOffers", () => {
  it("создаёт отдельное предложение для каждого склада и не использует общую цену или остаток", () => {
    const rows = normalizeOffers([part], part.number, part.brand);
    expect(rows).toHaveLength(2);
    expect(
      rows.map(({ warehouse, price, stock }) => ({ warehouse, price, stock })),
    ).toEqual([
      { warehouse: "МСК", price: 1200, stock: 3 },
      { warehouse: "СПБ", price: 1350, stock: 7 },
    ]);
    expect(rows.every((row) => row.isAnalogue === false)).toBe(true);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it("показывает товар без складов как отсутствующий, не подставляя устаревшую цену", () => {
    const [row] = normalizeOffers([{ ...part, warehouses: [] }]);
    expect(row).toMatchObject({ price: null, stock: 0, warehouse: "" });
  });

  it("разбирает вложенные аналоги и не дублирует одно складское предложение", () => {
    const analogue = {
      ...part,
      goodsID: "part-2",
      brand: "FEBI",
      number: "123",
      warehouses: [{ id: "msk", code: "МСК", price: 900, stock: 2 }],
    };
    const rows = normalizeOffers(
      [{ ...part, analogues: [analogue, analogue] }, analogue],
      part.number,
      part.brand,
    );
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.brand === "FEBI")).toMatchObject({
      isAnalogue: true,
      price: 900,
      stock: 2,
    });
  });

  it("сохраняет предложения с нулевым остатком", () => {
    expect(
      normalizeOffers([{ ...part, warehouses: [{ price: 350, stock: 0 }] }])[0],
    ).toMatchObject({ price: 350, stock: 0 });
  });

  it("безопасно разбирает числовые строки и отсутствующие значения", () => {
    const rows = normalizeOffers([
      {
        ...part,
        warehouses: [
          { id: "a", price: "120.50", stock: "4" },
          { id: "b", price: null, stock: -1 },
          { id: "c", stock: 2 },
        ],
      },
    ]);
    expect(rows.map(({ price, stock }) => [price, stock])).toEqual([
      [120.5, 4],
      [null, 0],
      [null, 2],
    ]);
  });

  it("возвращает пустой список для пустых данных", () => {
    expect(normalizeOffers([{}, null])).toEqual([]);
  });

  it.each([
    ["7160500039S", "7160500039/S"],
    ["7160500039/S", "7160500039S"],
  ])(
    "считает артикулы %s и %s одной искомой деталью",
    (selectedNumber, returnedNumber) => {
      const rows = normalizeOffers(
        [{ ...part, number: returnedNumber }],
        selectedNumber,
        part.brand,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.isAnalogue === false)).toBe(true);
    },
  );

  it("не удаляет значимые символы # и & при сравнении артикулов", () => {
    const [row] = normalizeOffers(
      [{ ...part, number: "A#1&2" }],
      "A12",
      part.brand,
    );
    expect(row.isAnalogue).toBe(true);
  });

  it("не изменяет исходные данные", () => {
    const source = structuredClone(part);
    normalizeOffers([source]);
    expect(source).toEqual(part);
  });
});
