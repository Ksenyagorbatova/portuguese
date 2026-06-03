// ─────────────────────────────────────────────────────────────────────────────
// COURSE CONTENT — single source of truth.
//
// This file is git-versioned and seeded into Convex tables by `convex/seed.ts`
// (idempotent upsert by natural keys: topicKey / lessonKey / pt / sentenceKey).
//
// To add or edit content: change this file, push to main → CI re-seeds the DB.
// Rules:
//   • Each lesson `id` (lessonKey) and each word `pt` must be STABLE — user
//     progress is keyed on (lessonKey, pt), so renaming them orphans progress.
//   • CROSS_SENTENCES get a stable `sentenceKey = cs_NNNN` from their array index,
//     so only APPEND new sentences to the end (don't insert in the middle).
// ─────────────────────────────────────────────────────────────────────────────

export type Word = { pt: string; ru: string; note?: string };
export type TheorySection = { heading: string; words: string[] };
export type Theory = { intro: string; tip: string; sections: TheorySection[] };
export type Lesson = { id: string; label: string; theory: Theory; words: Word[] };
export type Topic = { label: string; icon: string; lessons: Lesson[] };
export type CrossSentence = {
  words: string[];
  answer: string;
  ru: string;
  required: string[];
};

// Each topic has sub-lessons (max 10 words each).
// Cross-topic sentences reference words from multiple topics.
// Sentences appear only when required words are learned.

export const TOPICS: Record<string, Topic> = {
  greetings: {
    label: "Приветствия",
    icon: "👋",
    lessons: [
      {
        id: "greetings_1",
        label: "Часть 1 — Приветствия",
        theory: {
          intro:
            "Приветствия зависят от времени суток. «Спасибо» меняется по полу говорящего: obrigado — мужчина, obrigada — женщина.",
          tip: "🇵🇹 Bom dia — до ~13:00. Boa tarde — после полудня. Boa noite — вечером и уходя спать.",
          sections: [
            { heading: "По времени суток", words: ["Olá", "Bom dia", "Boa tarde", "Boa noite"] },
            { heading: "Благодарность", words: ["Obrigado", "Obrigada", "Por favor", "De nada"] },
            { heading: "Прощание", words: ["Até logo", "Tchau"] },
          ],
        },
        words: [
          { pt: "Olá", ru: "Привет" },
          { pt: "Bom dia", ru: "Доброе утро", note: "до полудня" },
          { pt: "Boa tarde", ru: "Добрый день", note: "после полудня" },
          { pt: "Boa noite", ru: "Добрый вечер / Спокойной ночи" },
          { pt: "Obrigado", ru: "Спасибо (муж.)", note: "говорит мужчина" },
          { pt: "Obrigada", ru: "Спасибо (жен.)", note: "говорит женщина" },
          { pt: "Por favor", ru: "Пожалуйста", note: "просьба" },
          { pt: "De nada", ru: "Не за что" },
          { pt: "Até logo", ru: "До свидания" },
          { pt: "Tchau", ru: "Пока", note: "неформально" },
        ],
      },
      {
        id: "greetings_2",
        label: "Часть 2 — Вежливость и знакомство",
        theory: {
          intro:
            "Вежливые фразы для повседневного общения. Com licença — когда надо пройти. Desculpe — когда извиняешься.",
          tip: "🇵🇹 Como está? — вежливое «как дела?». Como estás? — неформальное (другу). Estou bem! — «Я в порядке!»",
          sections: [
            { heading: "Вежливость", words: ["Com licença", "Desculpe", "Com certeza", "Claro"] },
            {
              heading: "Знакомство",
              words: ["Como se chama?", "Chamo-me...", "Prazer!", "Como está?", "Estou bem.", "Até amanhã"],
            },
          ],
        },
        words: [
          { pt: "Com licença", ru: "Разрешите / Извините", note: "чтобы пройти" },
          { pt: "Desculpe", ru: "Простите", note: "извинение" },
          { pt: "Com certeza", ru: "Конечно", note: "уверенное согласие" },
          { pt: "Claro", ru: "Ясно / Конечно" },
          { pt: "Como se chama?", ru: "Как вас зовут?" },
          { pt: "Chamo-me...", ru: "Меня зовут..." },
          { pt: "Prazer!", ru: "Приятно познакомиться!" },
          { pt: "Como está?", ru: "Как дела? (вежливо)" },
          { pt: "Estou bem.", ru: "Я в порядке." },
          { pt: "Até amanhã", ru: "До завтра" },
        ],
      },
    ],
  },

  numbers: {
    label: "Числа",
    icon: "🔢",
    lessons: [
      {
        id: "numbers_1",
        label: "Числа 0–10",
        theory: {
          intro:
            "Числа 1 и 2 имеют мужской и женский род: um/uma, dois/duas. Остальные неизменяемые.",
          tip: "🇵🇹 Um café — один кофе. Uma água — одна вода. Dois copos — два стакана.",
          sections: [
            {
              heading: "0–10",
              words: ["zero", "um / uma", "dois / duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"],
            },
          ],
        },
        words: [
          { pt: "zero", ru: "ноль" },
          { pt: "um / uma", ru: "один / одна" },
          { pt: "dois / duas", ru: "два / две" },
          { pt: "três", ru: "три" },
          { pt: "quatro", ru: "четыре" },
          { pt: "cinco", ru: "пять" },
          { pt: "seis", ru: "шесть" },
          { pt: "sete", ru: "семь" },
          { pt: "oito", ru: "восемь" },
          { pt: "nove", ru: "девять" },
          { pt: "dez", ru: "десять" },
        ],
      },
      {
        id: "numbers_2",
        label: "Числа 11–100",
        theory: {
          intro:
            "11–15 надо просто запомнить. 16–19: dez + seis/sete... → dezasseis. 20 — vinte, 30 — trinta, 100 — cem.",
          tip: "🇵🇹 «Tenho vinte anos» — «Мне двадцать лет». Возраст всегда с глаголом ter (иметь).",
          sections: [
            {
              heading: "11–20",
              words: ["onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove", "vinte"],
            },
            { heading: "Десятки", words: ["trinta", "quarenta", "cinquenta", "sessenta", "cem"] },
          ],
        },
        words: [
          { pt: "onze", ru: "одиннадцать" },
          { pt: "doze", ru: "двенадцать" },
          { pt: "treze", ru: "тринадцать" },
          { pt: "catorze", ru: "четырнадцать" },
          { pt: "quinze", ru: "пятнадцать" },
          { pt: "dezasseis", ru: "шестнадцать" },
          { pt: "dezassete", ru: "семнадцать" },
          { pt: "dezoito", ru: "восемнадцать" },
          { pt: "dezanove", ru: "девятнадцать" },
          { pt: "vinte", ru: "двадцать" },
          { pt: "trinta", ru: "тридцать" },
          { pt: "quarenta", ru: "сорок" },
          { pt: "cinquenta", ru: "пятьдесят" },
          { pt: "cem", ru: "сто" },
        ],
      },
    ],
  },

  basics: {
    label: "Базовые слова",
    icon: "📝",
    lessons: [
      {
        id: "basics_1",
        label: "Часть 1 — Да, нет, качество",
        theory: {
          intro:
            "Прилагательные согласуются с родом: bom/boa, mau/má, pequeno/pequena. Исключения: grande, simples — для обоих родов.",
          tip: "🇵🇹 muito (очень) перед прилагательным не меняется: muito bom, muito boa. Перед существительным: muito calor, muita água.",
          sections: [
            { heading: "Да / нет / союзы", words: ["sim", "não", "e", "ou", "mas", "porque"] },
            {
              heading: "Качество",
              words: ["muito", "pouco", "bom / boa", "mau / má", "grande", "pequeno", "novo", "velho", "caro", "barato"],
            },
          ],
        },
        words: [
          { pt: "sim", ru: "да" },
          { pt: "não", ru: "нет" },
          { pt: "e", ru: "и" },
          { pt: "ou", ru: "или" },
          { pt: "mas", ru: "но" },
          { pt: "porque", ru: "потому что" },
          { pt: "muito", ru: "очень / много" },
          { pt: "pouco", ru: "мало / немного" },
          { pt: "bom / boa", ru: "хороший / хорошая" },
          { pt: "mau / má", ru: "плохой / плохая" },
        ],
      },
      {
        id: "basics_2",
        label: "Часть 2 — Размер, время, место",
        theory: {
          intro:
            "Слова для описания размера, расположения во времени и пространстве. Muito важное слово — запомни первым!",
          tip: "🇵🇹 Сегодня/завтра/вчера: hoje/amanhã/ontem. Ontem foi bom. — Вчера было хорошо.",
          sections: [
            {
              heading: "Размер и вид",
              words: ["grande", "pequeno", "novo", "velho", "caro", "barato", "bonito", "feio"],
            },
            {
              heading: "Время и место",
              words: ["aqui", "ali", "agora", "hoje", "amanhã", "ontem", "sempre", "nunca"],
            },
          ],
        },
        words: [
          { pt: "grande", ru: "большой" },
          { pt: "pequeno", ru: "маленький" },
          { pt: "novo", ru: "новый / молодой" },
          { pt: "velho", ru: "старый" },
          { pt: "caro", ru: "дорогой" },
          { pt: "barato", ru: "дешёвый" },
          { pt: "bonito", ru: "красивый" },
          { pt: "feio", ru: "некрасивый" },
          { pt: "aqui", ru: "здесь" },
          { pt: "ali", ru: "там" },
          { pt: "agora", ru: "сейчас" },
          { pt: "hoje", ru: "сегодня" },
          { pt: "amanhã", ru: "завтра" },
          { pt: "ontem", ru: "вчера" },
          { pt: "sempre", ru: "всегда" },
          { pt: "nunca", ru: "никогда" },
        ],
      },
    ],
  },

  verbs: {
    label: "Глаголы",
    icon: "⚡",
    lessons: [
      {
        id: "verbs_1",
        label: "Часть 1 — Ser, Estar и главные глаголы",
        theory: {
          intro:
            "Два глагола «быть»: ser — постоянное (профессия, национальность), estar — временное (состояние, место).",
          tip: "🇵🇹 Sou russo. — Я русский. (ser)\nEstou cansado. — Я устал. (estar)\nEstou em Lisboa. — Я в Лиссабоне. (estar)",
          sections: [
            { heading: "Два глагола «быть»", words: ["ser", "estar"] },
            { heading: "Самые важные", words: ["ter", "fazer", "ir", "vir", "falar", "comer", "beber"] },
          ],
        },
        words: [
          { pt: "ser", ru: "быть (постоянно)", note: "eu sou = я есть" },
          { pt: "estar", ru: "быть (временно/место)", note: "eu estou = я сейчас" },
          { pt: "ter", ru: "иметь", note: "eu tenho = у меня есть" },
          { pt: "fazer", ru: "делать", note: "eu faço = я делаю" },
          { pt: "ir", ru: "идти / ехать", note: "eu vou = я иду" },
          { pt: "vir", ru: "приходить", note: "eu venho = я прихожу" },
          { pt: "falar", ru: "говорить", note: "eu falo = я говорю" },
          { pt: "comer", ru: "есть / кушать", note: "eu como = я ем" },
          { pt: "beber", ru: "пить", note: "eu bebo = я пью" },
          { pt: "querer", ru: "хотеть", note: "eu quero = я хочу" },
        ],
      },
      {
        id: "verbs_2",
        label: "Часть 2 — Модальные и бытовые",
        theory: {
          intro:
            "Глаголы poder (мочь), saber (знать/уметь), gostar (нравиться). Gostar всегда с «de»: Gosto de café. — Мне нравится кофе.",
          tip: "🇵🇹 trabalhar (работать) → eu trabalho. morar (жить) → eu moro em... Эти глаголы правильные, легко спрягаются.",
          sections: [
            { heading: "Модальные", words: ["poder", "saber", "querer", "precisar"] },
            {
              heading: "Бытовые",
              words: ["trabalhar", "morar", "gostar", "chamar-se", "comprar", "vender"],
            },
          ],
        },
        words: [
          { pt: "poder", ru: "мочь / уметь", note: "eu posso = я могу" },
          { pt: "saber", ru: "знать / уметь", note: "eu sei = я знаю" },
          { pt: "precisar", ru: "нуждаться / нужно", note: "preciso de... = мне нужно..." },
          { pt: "trabalhar", ru: "работать", note: "eu trabalho = я работаю" },
          { pt: "morar", ru: "жить / проживать", note: "eu moro em... = я живу в..." },
          { pt: "gostar", ru: "нравиться / любить", note: "gosto de... = мне нравится..." },
          { pt: "chamar-se", ru: "называться / зовут", note: "chamo-me = меня зовут" },
          { pt: "comprar", ru: "покупать", note: "eu compro = я покупаю" },
          { pt: "vender", ru: "продавать", note: "eu vendo = я продаю" },
          { pt: "abrir", ru: "открывать", note: "eu abro = я открываю" },
        ],
      },
    ],
  },

  family: {
    label: "Семья",
    icon: "👨‍👩‍👧",
    lessons: [
      {
        id: "family_1",
        label: "Семья",
        theory: {
          intro:
            "Слова для членов семьи. У многих мужская и женская форма: pai/mãe, irmão/irmã, filho/filha.",
          tip: "🇵🇹 Tenho um irmão. — У меня есть брат. Não tenho filhos. — У меня нет детей. Глагол ter (иметь) для семьи.",
          sections: [
            {
              heading: "Ближайшие",
              words: ["pai", "mãe", "irmão", "irmã", "filho", "filha", "marido", "mulher"],
            },
            { heading: "Расширенная семья", words: ["avô", "avó", "tio", "tia", "primo", "prima"] },
          ],
        },
        words: [
          { pt: "pai", ru: "отец" },
          { pt: "mãe", ru: "мать" },
          { pt: "irmão", ru: "брат" },
          { pt: "irmã", ru: "сестра" },
          { pt: "filho", ru: "сын" },
          { pt: "filha", ru: "дочь" },
          { pt: "marido", ru: "муж" },
          { pt: "mulher", ru: "жена / женщина" },
          { pt: "avô", ru: "дедушка" },
          { pt: "avó", ru: "бабушка" },
        ],
      },
    ],
  },

  colors: {
    label: "Цвета",
    icon: "🎨",
    lessons: [
      {
        id: "colors_1",
        label: "Цвета и внешность",
        theory: {
          intro:
            "Цвета согласуются с родом: carro vermelho (красная машина), casa vermelha. Исключения без изменений: azul, verde, laranja, cor-de-rosa.",
          tip: "🇵🇹 Ele é alto e magro. — Он высокий и худой. Ela tem olhos azuis. — У неё голубые глаза. (ter = иметь)",
          sections: [
            {
              heading: "Цвета",
              words: ["vermelho", "azul", "verde", "amarelo", "preto", "branco", "cor-de-rosa", "laranja", "castanho", "cinzento"],
            },
          ],
        },
        words: [
          { pt: "vermelho", ru: "красный" },
          { pt: "azul", ru: "синий / голубой" },
          { pt: "verde", ru: "зелёный" },
          { pt: "amarelo", ru: "жёлтый" },
          { pt: "preto", ru: "чёрный" },
          { pt: "branco", ru: "белый" },
          { pt: "cor-de-rosa", ru: "розовый" },
          { pt: "laranja", ru: "оранжевый" },
          { pt: "castanho", ru: "коричневый" },
          { pt: "cinzento", ru: "серый" },
        ],
      },
      {
        id: "colors_2",
        label: "Внешность",
        theory: {
          intro:
            "Описание внешности. Alto/baixo — рост, gordo/magro — телосложение. Прилагательные согласуются с родом человека.",
          tip: "🇵🇹 Ele é alto. — Он высокий. Ela é alta. — Она высокая. Обратите внимание на окончание!",
          sections: [
            {
              heading: "Внешность",
              words: ["alto", "baixo", "gordo", "magro", "jovem", "idoso", "comprido", "curto"],
            },
          ],
        },
        words: [
          { pt: "alto", ru: "высокий" },
          { pt: "baixo", ru: "низкий" },
          { pt: "gordo", ru: "толстый" },
          { pt: "magro", ru: "худой" },
          { pt: "jovem", ru: "молодой" },
          { pt: "idoso", ru: "пожилой" },
          { pt: "comprido", ru: "длинный" },
          { pt: "curto", ru: "короткий" },
          { pt: "olho", ru: "глаз" },
          { pt: "cabelo", ru: "волосы" },
        ],
      },
    ],
  },

  food: {
    label: "Еда",
    icon: "🍽️",
    lessons: [
      {
        id: "food_1",
        label: "Еда — основное",
        theory: {
          intro:
            "В кафе: «Quero...» + слово из меню работает везде. Um/uma = одна порция. A conta — счёт.",
          tip: "🇵🇹 Um café = эспрессо. Galão = большой кофе с молоком. Pastel de nata — обязательно попробуй!",
          sections: [
            {
              heading: "Еда",
              words: ["pão", "água", "café", "leite", "frango", "peixe", "arroz", "sopa", "salada", "fruta"],
            },
          ],
        },
        words: [
          { pt: "pão", ru: "хлеб" },
          { pt: "água", ru: "вода" },
          { pt: "café", ru: "кофе" },
          { pt: "leite", ru: "молоко" },
          { pt: "frango", ru: "курица" },
          { pt: "peixe", ru: "рыба" },
          { pt: "arroz", ru: "рис" },
          { pt: "sopa", ru: "суп" },
          { pt: "salada", ru: "салат" },
          { pt: "fruta", ru: "фрукты" },
        ],
      },
      {
        id: "food_2",
        label: "Напитки и ресторан",
        theory: {
          intro:
            "В ресторане: pequeno-almoço (завтрак), almoço (обед), jantar (ужин). Sobremesa — десерт.",
          tip: "🇵🇹 Vinho verde — молодое белое вино, символ Португалии. Cerveja — пиво. «A conta, por favor» — счёт.",
          sections: [
            { heading: "Напитки", words: ["vinho", "cerveja", "sumo", "chá", "água com gás"] },
            {
              heading: "Приёмы пищи",
              words: ["pequeno-almoço", "almoço", "jantar", "sobremesa", "conta"],
            },
          ],
        },
        words: [
          { pt: "vinho", ru: "вино" },
          { pt: "cerveja", ru: "пиво" },
          { pt: "sumo", ru: "сок", note: "в Португалии sumo, не suco" },
          { pt: "chá", ru: "чай" },
          { pt: "água com gás", ru: "газированная вода" },
          { pt: "pequeno-almoço", ru: "завтрак" },
          { pt: "almoço", ru: "обед" },
          { pt: "jantar", ru: "ужин" },
          { pt: "sobremesa", ru: "десерт" },
          { pt: "conta", ru: "счёт" },
        ],
      },
    ],
  },

  days_time: {
    label: "Дни и время",
    icon: "📅",
    lessons: [
      {
        id: "days_1",
        label: "Дни недели",
        theory: {
          intro:
            "Дни недели не пишутся с заглавной буквы. Название от числа: segunda (второй), terça (третий)... feira = ярмарочный день.",
          tip: "🇵🇹 «Que dia é hoje?» — Какой сегодня день? «Hoje é quarta-feira.» — Сегодня среда.",
          sections: [
            {
              heading: "Дни недели",
              words: ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"],
            },
          ],
        },
        words: [
          { pt: "segunda-feira", ru: "понедельник" },
          { pt: "terça-feira", ru: "вторник" },
          { pt: "quarta-feira", ru: "среда" },
          { pt: "quinta-feira", ru: "четверг" },
          { pt: "sexta-feira", ru: "пятница" },
          { pt: "sábado", ru: "суббота" },
          { pt: "domingo", ru: "воскресенье" },
          { pt: "semana", ru: "неделя" },
          { pt: "fim de semana", ru: "выходные" },
          { pt: "dia", ru: "день" },
        ],
      },
      {
        id: "days_2",
        label: "Время и части суток",
        theory: {
          intro:
            "Время: São três horas. (три часа). É meio-dia. (полдень). É meia-noite. (полночь). Que horas são? — Который час?",
          tip: "🇵🇹 Manhã = утро. Tarde = день/вечер. Noite = ночь. De manhã = утром. À tarde = днём/вечером.",
          sections: [
            { heading: "Части суток", words: ["manhã", "tarde", "noite", "meio-dia", "meia-noite"] },
            { heading: "Время", words: ["hora", "minuto", "mês", "ano", "cedo", "tarde", "logo"] },
          ],
        },
        words: [
          { pt: "manhã", ru: "утро" },
          { pt: "tarde", ru: "день / вечер" },
          { pt: "noite", ru: "ночь" },
          { pt: "meio-dia", ru: "полдень" },
          { pt: "meia-noite", ru: "полночь" },
          { pt: "hora", ru: "час" },
          { pt: "minuto", ru: "минута" },
          { pt: "mês", ru: "месяц" },
          { pt: "ano", ru: "год" },
          { pt: "cedo", ru: "рано" },
        ],
      },
    ],
  },

  city: {
    label: "Город",
    icon: "🏙️",
    lessons: [
      {
        id: "city_1",
        label: "Места в городе",
        theory: {
          intro:
            "Onde é...? — Где...? Для направлений: à direita (направо), à esquerda (налево), em frente (прямо).",
          tip: "🇵🇹 В Лиссабоне: Baixa — центр, Alfama — старый квартал, Belém — район с башней.",
          sections: [
            {
              heading: "Места",
              words: ["rua", "praça", "hospital", "farmácia", "banco", "hotel", "restaurante", "supermercado", "estação", "aeroporto"],
            },
          ],
        },
        words: [
          { pt: "rua", ru: "улица" },
          { pt: "praça", ru: "площадь" },
          { pt: "hospital", ru: "больница" },
          { pt: "farmácia", ru: "аптека" },
          { pt: "banco", ru: "банк" },
          { pt: "hotel", ru: "отель" },
          { pt: "restaurante", ru: "ресторан" },
          { pt: "supermercado", ru: "супермаркет" },
          { pt: "estação", ru: "станция / вокзал" },
          { pt: "aeroporto", ru: "аэропорт" },
        ],
      },
      {
        id: "city_2",
        label: "Транспорт и направления",
        theory: {
          intro:
            "«Ir de» + транспорт: Vou de metro. — Еду на метро. «A pé» — пешком (пешком = de pé — на ногах).",
          tip: "🇵🇹 В Лиссабоне: eléctrico (трамвай 28!), metro, autocarro, ferry через реку Тежу.",
          sections: [
            { heading: "Транспорт", words: ["autocarro", "metro", "comboio", "táxi", "carro", "avião", "barco"] },
            {
              heading: "Направления",
              words: ["direita", "esquerda", "em frente", "perto", "longe", "aqui", "ali"],
            },
          ],
        },
        words: [
          { pt: "autocarro", ru: "автобус" },
          { pt: "metro", ru: "метро" },
          { pt: "comboio", ru: "поезд" },
          { pt: "táxi", ru: "такси" },
          { pt: "carro", ru: "машина" },
          { pt: "avião", ru: "самолёт" },
          { pt: "barco", ru: "лодка / корабль" },
          { pt: "direita", ru: "направо / правый" },
          { pt: "esquerda", ru: "налево / левый" },
          { pt: "em frente", ru: "прямо / напротив" },
        ],
      },
    ],
  },

  body: {
    label: "Тело и здоровье",
    icon: "🏥",
    lessons: [
      {
        id: "body_1",
        label: "Части тела",
        theory: {
          intro:
            "Dói-me a cabeça. — У меня болит голова. Tenho dores de... — У меня боли в... (dores = боли, мн.ч.)",
          tip: "🇵🇹 112 — номер скорой в Португалии. Preciso de um médico. — Мне нужен врач. Chame uma ambulância! — Вызовите скорую!",
          sections: [
            {
              heading: "Части тела",
              words: ["cabeça", "mão", "pé", "olho", "nariz", "boca", "ouvido", "costas", "estômago", "braço"],
            },
          ],
        },
        words: [
          { pt: "cabeça", ru: "голова" },
          { pt: "mão", ru: "рука (кисть)" },
          { pt: "pé", ru: "нога (ступня)" },
          { pt: "olho", ru: "глаз" },
          { pt: "nariz", ru: "нос" },
          { pt: "boca", ru: "рот" },
          { pt: "ouvido", ru: "ухо" },
          { pt: "costas", ru: "спина" },
          { pt: "estômago", ru: "живот / желудок" },
          { pt: "braço", ru: "рука (целиком)" },
        ],
      },
      {
        id: "body_2",
        label: "Здоровье и самочувствие",
        theory: {
          intro:
            "Состояния: estou cansado (устал), estou doente (болен). Tenho febre (есть температура). Глагол estar для временных состояний.",
          tip: "🇵🇹 В аптеке (farmácia): Tem aspirina? — Есть аспирин? Tenho dores de cabeça. — У меня болит голова.",
          sections: [
            {
              heading: "Здоровье",
              words: ["médico", "farmácia", "comprimido", "febre", "dor", "doente", "cansado", "alérgico", "ambulância"],
            },
          ],
        },
        words: [
          { pt: "médico", ru: "врач" },
          { pt: "comprimido", ru: "таблетка" },
          { pt: "febre", ru: "температура / жар" },
          { pt: "dor", ru: "боль" },
          { pt: "doente", ru: "больной" },
          { pt: "cansado", ru: "усталый" },
          { pt: "alérgico", ru: "аллергичный" },
          { pt: "ambulância", ru: "скорая помощь" },
          { pt: "perna", ru: "нога (целиком)" },
          { pt: "cabelo", ru: "волосы" },
        ],
      },
    ],
  },

  home: {
    label: "Дом",
    icon: "🏠",
    lessons: [
      {
        id: "home_1",
        label: "Комнаты и мебель",
        theory: {
          intro:
            "Estar em casa — быть дома. O livro está na mesa — книга на столе. Na = em + a (в/на + артикль жен.р.). No = em + o (муж.р.).",
          tip: "🇵🇹 rés-do-chão = ground floor (первый этаж у нас). primeiro andar = второй этаж. Важно в отелях!",
          sections: [
            {
              heading: "Помещения",
              words: ["casa", "apartamento", "quarto", "sala", "cozinha", "casa de banho", "jardim", "janela", "porta"],
            },
            { heading: "Мебель", words: ["mesa", "cadeira", "cama", "sofá", "televisão"] },
          ],
        },
        words: [
          { pt: "casa", ru: "дом" },
          { pt: "apartamento", ru: "квартира" },
          { pt: "quarto", ru: "комната / спальня" },
          { pt: "sala", ru: "гостиная" },
          { pt: "cozinha", ru: "кухня" },
          { pt: "casa de banho", ru: "ванная / туалет" },
          { pt: "janela", ru: "окно" },
          { pt: "porta", ru: "дверь" },
          { pt: "mesa", ru: "стол" },
          { pt: "cama", ru: "кровать" },
        ],
      },
      {
        id: "home_2",
        label: "Вещи и предметы",
        theory: {
          intro:
            "Предметы в доме. Ter (иметь) для описания вещей: Tenho um computador. — У меня есть компьютер.",
          tip: "🇵🇹 Слова совпадают с русским: computador, televisão, telefone. Португальский близок к другим Romance языкам.",
          sections: [
            {
              heading: "Предметы",
              words: ["computador", "telefone", "chave", "livro", "roupa", "cadeira", "sofá", "frigorífico"],
            },
          ],
        },
        words: [
          { pt: "computador", ru: "компьютер" },
          { pt: "telefone", ru: "телефон" },
          { pt: "chave", ru: "ключ" },
          { pt: "livro", ru: "книга" },
          { pt: "roupa", ru: "одежда" },
          { pt: "cadeira", ru: "стул" },
          { pt: "sofá", ru: "диван" },
          { pt: "frigorífico", ru: "холодильник" },
          { pt: "televisão", ru: "телевизор" },
          { pt: "jardim", ru: "сад" },
        ],
      },
    ],
  },

  weather: {
    label: "Погода",
    icon: "☀️",
    lessons: [
      {
        id: "weather_1",
        label: "Погода и природа",
        theory: {
          intro:
            "Estar + прилагательное для погоды: Está sol. (солнечно), Está frio. (холодно). Или Faz calor/frio — тоже правильно.",
          tip: "🇵🇹 Лиссабон — 2800+ солнечных часов в год. Que dia bonito! — Какой красивый день! Está a chover. — Идёт дождь.",
          sections: [
            {
              heading: "Погода",
              words: ["sol", "chuva", "vento", "nuvem", "frio", "calor", "neve", "nevoeiro", "tempo"],
            },
            { heading: "Природа", words: ["mar", "rio", "montanha", "praia", "floresta", "céu"] },
          ],
        },
        words: [
          { pt: "sol", ru: "солнце / солнечно" },
          { pt: "chuva", ru: "дождь" },
          { pt: "vento", ru: "ветер" },
          { pt: "nuvem", ru: "облако" },
          { pt: "frio", ru: "холод / холодно" },
          { pt: "calor", ru: "жара / жарко" },
          { pt: "neve", ru: "снег" },
          { pt: "nevoeiro", ru: "туман" },
          { pt: "tempo", ru: "погода / время" },
          { pt: "mar", ru: "море" },
        ],
      },
    ],
  },

  phrases: {
    label: "Фразы выживания",
    icon: "💬",
    lessons: [
      {
        id: "phrases_1",
        label: "Понимание и помощь",
        theory: {
          intro:
            "Фразы для непонимания и просьб о помощи. Запоминай целиком — разбор структуры придёт потом.",
          tip: "🇵🇹 Португальцы очень ценят попытки говорить по-португальски. Улыбнись и скажи «Não percebo» — обязательно помогут.",
          sections: [
            {
              heading: "Непонимание",
              words: ["Não percebo.", "Pode repetir?", "Mais devagar, por favor.", "Como se diz...?", "Não falo bem português."],
            },
            {
              heading: "Помощь",
              words: ["Preciso de ajuda.", "Pode ajudar-me?", "Onde é...?", "Como chego a...?", "Tem...?"],
            },
          ],
        },
        words: [
          { pt: "Não percebo.", ru: "Я не понимаю." },
          { pt: "Pode repetir?", ru: "Можете повторить?" },
          { pt: "Mais devagar, por favor.", ru: "Помедленнее, пожалуйста." },
          { pt: "Como se diz...?", ru: "Как сказать...?" },
          { pt: "Não falo bem português.", ru: "Я не очень хорошо говорю по-португальски." },
          { pt: "Preciso de ajuda.", ru: "Мне нужна помощь." },
          { pt: "Pode ajudar-me?", ru: "Вы можете мне помочь?" },
          { pt: "Quanto custa?", ru: "Сколько стоит?" },
          { pt: "A conta, por favor.", ru: "Счёт, пожалуйста." },
          { pt: "De onde é?", ru: "Откуда вы?" },
        ],
      },
    ],
  },
};

// ─── Cross-topic sentences ─────────────────────────────────────────────────
// required: array of word.pt that must be learned before sentence appears.
// These combine vocabulary from multiple topics.
// APPEND-ONLY: sentenceKey is derived from array index (cs_0001, cs_0002, ...).

export const CROSS_SENTENCES: CrossSentence[] = [
  // greetings + verbs
  { words: ["Bom", "dia!", "Estou", "bem,", "obrigado."], answer: "Bom dia! Estou bem, obrigado.", ru: "Доброе утро! Я в порядке, спасибо.", required: ["Bom dia", "Estou bem.", "Obrigado"] },
  { words: ["Olá!", "Como", "está?", "Estou", "muito", "bem!"], answer: "Olá! Como está? Estou muito bem!", ru: "Привет! Как дела? Я очень хорошо!", required: ["Olá", "Como está?", "muito"] },
  // verbs + food
  { words: ["Quero", "um", "café,", "por", "favor."], answer: "Quero um café, por favor.", ru: "Хочу кофе, пожалуйста.", required: ["querer", "café", "Por favor"] },
  { words: ["Tenho", "fome.", "Quero", "comer."], answer: "Tenho fome. Quero comer.", ru: "Я голоден. Хочу есть.", required: ["ter", "comer", "querer"] },
  { words: ["Gosto", "de", "peixe", "e", "arroz."], answer: "Gosto de peixe e arroz.", ru: "Мне нравится рыба с рисом.", required: ["gostar", "peixe", "arroz"] },
  // verbs + city
  { words: ["Vou", "de", "metro", "para", "o", "aeroporto."], answer: "Vou de metro para o aeroporto.", ru: "Еду на метро в аэропорт.", required: ["ir", "metro", "aeroporto"] },
  { words: ["Onde", "é", "a", "farmácia?"], answer: "Onde é a farmácia?", ru: "Где аптека?", required: ["farmácia"] },
  { words: ["O", "restaurante", "é", "perto", "daqui."], answer: "O restaurante é perto daqui.", ru: "Ресторан здесь близко.", required: ["restaurante", "perto"] },
  // basics + family
  { words: ["O", "meu", "pai", "é", "alto", "e", "velho."], answer: "O meu pai é alto e velho.", ru: "Мой отец высокий и старый.", required: ["pai", "alto", "velho"] },
  { words: ["A", "minha", "mãe", "é", "muito", "bonita."], answer: "A minha mãe é muito bonita.", ru: "Моя мама очень красивая.", required: ["mãe", "muito", "bonito"] },
  { words: ["Tenho", "um", "irmão", "e", "uma", "irmã."], answer: "Tenho um irmão e uma irmã.", ru: "У меня есть брат и сестра.", required: ["irmão", "irmã", "ter"] },
  // colors + family/body
  { words: ["O", "carro", "é", "vermelho", "e", "grande."], answer: "O carro é vermelho e grande.", ru: "Машина красная и большая.", required: ["vermelho", "grande", "carro"] },
  { words: ["Ela", "tem", "olhos", "azuis", "e", "cabelo", "castanho."], answer: "Ela tem olhos azuis e cabelo castanho.", ru: "У неё голубые глаза и каштановые волосы.", required: ["azul", "castanho", "olho", "cabelo"] },
  // food + numbers
  { words: ["Quero", "dois", "cafés,", "por", "favor."], answer: "Quero dois cafés, por favor.", ru: "Хочу два кофе, пожалуйста.", required: ["dois / duas", "café", "querer"] },
  { words: ["A", "conta", "é", "vinte", "euros."], answer: "A conta é vinte euros.", ru: "Счёт — двадцать евро.", required: ["conta", "vinte"] },
  // body + verbs
  { words: ["Tenho", "dores", "de", "cabeça."], answer: "Tenho dores de cabeça.", ru: "У меня болит голова.", required: ["cabeça", "ter"] },
  { words: ["Estou", "cansado", "e", "doente."], answer: "Estou cansado e doente.", ru: "Я устал и болен.", required: ["cansado", "doente", "estar"] },
  // weather + basics
  { words: ["Hoje", "está", "muito", "sol!"], answer: "Hoje está muito sol!", ru: "Сегодня очень солнечно!", required: ["hoje", "sol", "muito"] },
  { words: ["Faz", "frio", "mas", "o", "mar", "é", "bonito."], answer: "Faz frio mas o mar é bonito.", ru: "Холодно, но море красивое.", required: ["frio", "mar", "mas", "bonito"] },
  // days + verbs
  { words: ["Hoje", "é", "sexta-feira.", "Não", "trabalho!"], answer: "Hoje é sexta-feira. Não trabalho!", ru: "Сегодня пятница. Я не работаю!", required: ["sexta-feira", "hoje", "trabalhar"] },
  { words: ["Amanhã", "é", "sábado", "—", "fim", "de", "semana!"], answer: "Amanhã é sábado — fim de semana!", ru: "Завтра суббота — выходные!", required: ["amanhã", "sábado", "fim de semana"] },
  // home + verbs
  { words: ["Estou", "em", "casa.", "O", "livro", "está", "na", "mesa."], answer: "Estou em casa. O livro está na mesa.", ru: "Я дома. Книга на столе.", required: ["casa", "livro", "mesa", "estar"] },
  { words: ["Preciso", "de", "uma", "chave", "para", "o", "quarto."], answer: "Preciso de uma chave para o quarto.", ru: "Мне нужен ключ от комнаты.", required: ["precisar", "chave", "quarto"] },
  // mixed advanced
  { words: ["De", "onde", "é?", "Sou", "de", "Lisboa."], answer: "De onde é? Sou de Lisboa.", ru: "Откуда вы? Я из Лиссабона.", required: ["De onde é?", "ser"] },
  { words: ["Gosto", "de", "Portugal", "porque", "o", "tempo", "é", "bom."], answer: "Gosto de Portugal porque o tempo é bom.", ru: "Мне нравится Португалия, потому что погода хорошая.", required: ["gostar", "tempo", "bom / boa", "porque"] },
];
