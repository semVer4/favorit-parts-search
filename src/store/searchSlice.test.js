import { beforeEach, describe, expect, it, vi } from "vitest";
import { findBrands, findOffers } from "../api/partsApi.js";
import { createStore } from "./store.js";
import {
  brandSelected,
  fetchBrands,
  fetchOffers,
  numberChanged,
} from "./searchSlice.js";

vi.mock("../api/partsApi.js", () => ({
  findBrands: vi.fn(),
  findOffers: vi.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function storeWithNumber(number = "01089") {
  const store = createStore();
  store.dispatch(numberChanged(number));
  return store;
}

beforeEach(() => vi.resetAllMocks());

describe("поиск производителей", () => {
  it("хранит состояние загрузки и результат запроса", async () => {
    const store = storeWithNumber(" 01089 ");
    const response = deferred();
    const brands = [{ brand: "MEYLE", name: "Деталь" }];
    findBrands.mockReturnValue(response.promise);

    const request = store.dispatch(fetchBrands("01089"));
    expect(store.getState().search.brandsStatus).toBe("loading");
    expect(findBrands).toHaveBeenCalledWith("01089", expect.any(AbortSignal));

    response.resolve(brands);
    await request;
    expect(store.getState().search).toMatchObject({
      brands,
      brandsStatus: "succeeded",
      brandsError: null,
      brandsRequestId: null,
    });
  });

  it("сохраняет понятную ошибку API", async () => {
    const store = storeWithNumber();
    findBrands.mockRejectedValue(new Error("Превышен лимит запросов"));
    await store.dispatch(fetchBrands("01089"));

    expect(store.getState().search).toMatchObject({
      brandsStatus: "failed",
      brandsError: "Превышен лимит запросов",
      brandsRequestId: null,
    });
  });

  it("не перезаписывает новый поиск запоздавшим ответом старого", async () => {
    const store = storeWithNumber("old");
    const oldResponse = deferred();
    const newResponse = deferred();
    findBrands
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);

    const oldRequest = store.dispatch(fetchBrands("old"));
    store.dispatch(numberChanged("new"));
    const newRequest = store.dispatch(fetchBrands("new"));
    newResponse.resolve([{ brand: "NEW", name: "Новая деталь" }]);
    await newRequest;
    oldResponse.resolve([{ brand: "OLD", name: "Старая деталь" }]);
    await oldRequest;

    expect(store.getState().search.brands).toEqual([
      { brand: "NEW", name: "Новая деталь" },
    ]);
    expect(store.getState().search.brandsStatus).toBe("succeeded");
  });

  it("сбрасывает результаты и выбор бренда сразу при изменении артикула", async () => {
    const store = storeWithNumber();
    findBrands.mockResolvedValue([{ brand: "MEYLE", name: "Деталь" }]);
    await store.dispatch(fetchBrands("01089"));
    store.dispatch(brandSelected("MEYLE"));
    findOffers.mockResolvedValue([{ id: "offer" }]);
    await store.dispatch(fetchOffers({ number: "01089", brand: "MEYLE" }));

    store.dispatch(numberChanged("12345"));
    expect(store.getState().search).toEqual({
      number: "12345",
      brands: [],
      selectedBrand: "",
      offers: [],
      brandsStatus: "idle",
      offersStatus: "idle",
      brandsError: null,
      offersError: null,
      brandsRequestId: null,
      offersRequestId: null,
    });
  });

  it("отмена запроса не показывает ошибку пользователю", async () => {
    const store = storeWithNumber();
    findBrands.mockReturnValue(new Promise(() => {}));
    const request = store.dispatch(fetchBrands("01089"));
    request.abort();
    await request;

    expect(store.getState().search).toMatchObject({
      brandsStatus: "idle",
      brandsError: null,
      brandsRequestId: null,
    });
  });

  it("не отправляет запрос для пустого или уже изменившегося артикула", async () => {
    const store = storeWithNumber("01089");
    await store.dispatch(fetchBrands("   "));
    await store.dispatch(fetchBrands("other"));
    expect(findBrands).not.toHaveBeenCalled();
  });
});

describe("поиск предложений", () => {
  it("передаёт выбранный бренд и сохраняет результат", async () => {
    const store = storeWithNumber();
    const offers = [{ id: "offer", price: 500, stock: 3 }];
    store.dispatch(brandSelected("MEYLE"));
    findOffers.mockResolvedValue(offers);
    await store.dispatch(fetchOffers({ number: "01089", brand: "MEYLE" }));

    expect(findOffers).toHaveBeenCalledWith(
      "01089",
      "MEYLE",
      expect.any(AbortSignal),
    );
    expect(store.getState().search).toMatchObject({
      offers,
      offersStatus: "succeeded",
      offersError: null,
      offersRequestId: null,
    });
  });

  it("не применяет ответ для ранее выбранного бренда", async () => {
    const store = storeWithNumber();
    const oldResponse = deferred();
    const newResponse = deferred();
    findOffers
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);

    store.dispatch(brandSelected("OLD"));
    const oldRequest = store.dispatch(
      fetchOffers({ number: "01089", brand: "OLD" }),
    );
    store.dispatch(brandSelected("NEW"));
    const newRequest = store.dispatch(
      fetchOffers({ number: "01089", brand: "NEW" }),
    );
    newResponse.resolve([{ id: "new-offer" }]);
    await newRequest;
    oldResponse.resolve([{ id: "old-offer" }]);
    await oldRequest;

    expect(store.getState().search.selectedBrand).toBe("NEW");
    expect(store.getState().search.offers).toEqual([{ id: "new-offer" }]);
  });

  it("не возвращает старые предложения после изменения артикула", async () => {
    const store = storeWithNumber();
    const response = deferred();
    findOffers.mockReturnValue(response.promise);
    store.dispatch(brandSelected("MEYLE"));
    const request = store.dispatch(
      fetchOffers({ number: "01089", brand: "MEYLE" }),
    );
    store.dispatch(numberChanged("new"));
    response.resolve([{ id: "old-offer" }]);
    await request;

    expect(store.getState().search).toMatchObject({
      number: "new",
      selectedBrand: "",
      offers: [],
      offersStatus: "idle",
    });
  });

  it("обрабатывает ошибку получения предложений", async () => {
    const store = storeWithNumber();
    store.dispatch(brandSelected("MEYLE"));
    findOffers.mockRejectedValue(new Error("Сервис временно недоступен"));
    await store.dispatch(fetchOffers({ number: "01089", brand: "MEYLE" }));

    expect(store.getState().search).toMatchObject({
      offersStatus: "failed",
      offersError: "Сервис временно недоступен",
      offersRequestId: null,
    });
  });

  it("не сбрасывает предложения при повторном выборе того же бренда", async () => {
    const store = storeWithNumber();
    store.dispatch(brandSelected("MEYLE"));
    findOffers.mockResolvedValue([{ id: "offer" }]);
    await store.dispatch(fetchOffers({ number: "01089", brand: "MEYLE" }));
    store.dispatch(brandSelected("MEYLE"));

    expect(store.getState().search.offers).toEqual([{ id: "offer" }]);
    expect(store.getState().search.offersStatus).toBe("succeeded");
  });
});
