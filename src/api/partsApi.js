import { normalizeBrands, normalizeOffers } from "./normalize.js";

const API_URL = "https://api.favorit-parts.ru/hs/hsprice/";
// Публичный пример из документации API, не персональный ключ покупателя.
const PUBLIC_EXAMPLE_KEY = "00000000-0000-0000-0000-000000000001";
const REQUEST_TIMEOUT = 35_000;

function serviceError(error) {
  const description = Array.isArray(error) ? error.join(" ") : String(error);
  const messages = [
    [
      /Empty key/i,
      "Не задан ключ доступа к каталогу. Проверьте настройки приложения.",
    ],
    [/Invalid key client/i, "Ключ доступа к каталогу недействителен."],
    [/Empty number goods/i, "Введите артикул детали."],
    [
      /Request quota exceeded/i,
      "Превышен лимит запросов к каталогу. Попробуйте позже.",
    ],
  ]
    .filter(([pattern]) => pattern.test(description))
    .map(([, message]) => message);

  return messages.length
    ? messages.join(" ")
    : `Ошибка каталога: ${description}`;
}

async function requestGoods(params, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT);
  params.set("key", PUBLIC_EXAMPLE_KEY);

  try {
    const response = await fetch(`${API_URL}?${params}`, {
      signal: controller.signal,
    });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      if (!response.ok)
        throw new Error(
          `Каталог временно недоступен (HTTP ${response.status}). Попробуйте ещё раз.`,
        );
      throw new Error(
        "Каталог вернул некорректный ответ. Попробуйте повторить поиск.",
      );
    }

    if (data?.error) throw new Error(serviceError(data.error));
    if (!response.ok)
      throw new Error(
        `Каталог временно недоступен (HTTP ${response.status}). Попробуйте ещё раз.`,
      );
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !Array.isArray(data.goods)
    ) {
      throw new Error(
        "Каталог вернул некорректный ответ. Попробуйте повторить поиск.",
      );
    }

    return data.goods;
  } catch (error) {
    if (timedOut)
      throw new Error(
        "Каталог отвечает слишком долго. Попробуйте повторить поиск.",
      );
    if (error.name === "AbortError" || signal?.aborted) throw error;
    if (error instanceof TypeError) {
      throw new Error(
        "Не удалось связаться с каталогом. Проверьте соединение и повторите поиск.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function findBrands(number, signal) {
  const article = number.trim();
  if (!article) return [];
  const goods = await requestGoods(
    new URLSearchParams({ number: article }),
    signal,
  );
  return normalizeBrands(goods);
}

export async function findOffers(number, brand, signal) {
  const article = number.trim();
  const manufacturer = brand.trim();
  if (!article) return [];
  if (!manufacturer) throw new Error("Выберите производителя детали.");

  const goods = await requestGoods(
    new URLSearchParams({
      number: article,
      brand: manufacturer,
      analogues: "on",
    }),
    signal,
  );
  return normalizeOffers(goods, article, manufacturer);
}
