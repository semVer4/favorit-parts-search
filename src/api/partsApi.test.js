import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findBrands, findOffers } from "./partsApi.js";

const fetchMock = vi.fn();
const reply = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("partsApi", () => {
  it("запрашивает производителей по артикулу и передаёт AbortSignal", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(
      reply({ goods: [{ brand: "MEYLE", name: "Рычаг" }] }),
    );
    await expect(
      findBrands(" 7160500039S ", controller.signal),
    ).resolves.toEqual([{ brand: "MEYLE", name: "Рычаг" }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe("https://api.favorit-parts.ru");
    expect(url.pathname).toBe("/hs/hsprice/");
    expect(url.searchParams.get("number")).toBe("7160500039S");
    expect(url.searchParams.get("key")).toBe(
      "00000000-0000-0000-0000-000000000001",
    );
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("кодирует спецсимволы и запрашивает аналоги выбранного производителя", async () => {
    fetchMock.mockResolvedValue(reply({ goods: [] }));
    await findOffers("A#1&2", "Meat & Doria");
    const params = new URL(fetchMock.mock.calls[0][0], "http://localhost")
      .searchParams;
    expect(params.get("number")).toBe("A#1&2");
    expect(params.get("brand")).toBe("Meat & Doria");
    expect(params.get("analogues")).toBe("on");
    expect(params.get("key")).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("не отправляет пустой артикул", async () => {
    await expect(findBrands("  ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("требует выбрать производителя перед вторым запросом", async () => {
    await expect(findOffers("123", "")).rejects.toThrow(
      "Выберите производителя",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("понимает отсутствие результатов в формате [{}]", async () => {
    fetchMock.mockResolvedValue(reply({ goods: [{}] }));
    await expect(findBrands("unknown")).resolves.toEqual([]);
    await expect(findOffers("unknown", "MEYLE")).resolves.toEqual([]);
  });

  it("обрабатывает ошибку в JSON даже при HTTP 200", async () => {
    fetchMock.mockResolvedValue(reply({ error: "Invalid key client!" }));
    await expect(findBrands("123")).rejects.toThrow(
      "Ключ доступа к каталогу недействителен",
    );
  });

  it("переводит сообщение о превышении лимита", async () => {
    fetchMock.mockResolvedValue(reply({ error: "Request quota exceeded!" }));
    await expect(findBrands("123")).rejects.toThrow("Превышен лимит");
  });

  it("не принимает ответ без массива goods за отсутствие результатов", async () => {
    fetchMock.mockResolvedValue(reply({ data: [] }));
    await expect(findBrands("123")).rejects.toThrow("некорректный ответ");
  });

  it("обрабатывает HTTP-ошибку с не-JSON ответом", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError();
      },
    });
    await expect(findBrands("123")).rejects.toThrow("HTTP 502");
  });

  it("обрабатывает повреждённый JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError();
      },
    });
    await expect(findBrands("123")).rejects.toThrow("некорректный ответ");
  });

  it("показывает понятное сообщение при сетевой ошибке", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(findBrands("123")).rejects.toThrow(
      "Не удалось связаться с каталогом",
    );
  });

  it("сохраняет отмену запроса как AbortError", async () => {
    const error = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(error);
    await expect(findBrands("123")).rejects.toBe(error);
  });

  it("отменяет внутренний запрос при отмене внешнего сигнала", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const request = findBrands("123", controller.signal);
    const result = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await result;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("прерывает слишком долгий запрос и показывает сообщение о таймауте", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const result = expect(findBrands("123")).rejects.toThrow(
      "отвечает слишком долго",
    );
    await vi.advanceTimersByTimeAsync(35_000);
    await result;
  });
});
