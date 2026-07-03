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

// Each topic has sub-lessons (usually ~10 words; larger lessons close over several sessions).
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
          tip: "Bom dia — до ~13:00. Boa tarde — после полудня. Boa noite — вечером и уходя спать.",
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
          tip: "Como está? — вежливое «как дела?». Como estás? — неформальное (другу). Estou bem! — «Я в порядке!»",
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
      {
        id: "greetings_3",
        label: "Часть 3 — Пожелания и реакции",
        theory: {
          intro:
            "Короткие фразы-реакции на все случаи жизни. Parabéns — и «поздравляю», и «с днём рождения». Bem-vindo меняется по роду: женщине говорят bem-vinda.",
          tip: "Saúde! — тост «за здоровье!», а чихнувшему в Португалии говорят Santinho! Fixe — универсальное разговорное «класс!».",
          sections: [
            {
              heading: "Пожелания",
              words: ["Parabéns!", "Boa sorte!", "Bem-vindo!", "Bom apetite!", "Boa viagem!", "Saúde!", "Força!"],
            },
            { heading: "Реакции", words: ["Não faz mal.", "Que pena!", "Fixe!"] },
          ],
        },
        words: [
          { pt: "Parabéns!", ru: "Поздравляю! / С днём рождения!" },
          { pt: "Boa sorte!", ru: "Удачи!" },
          { pt: "Bem-vindo!", ru: "Добро пожаловать!", note: "женщине — bem-vinda" },
          { pt: "Bom apetite!", ru: "Приятного аппетита!" },
          { pt: "Boa viagem!", ru: "Счастливого пути!" },
          { pt: "Saúde!", ru: "За здоровье!", note: "тост; чихнувшему говорят Santinho!" },
          { pt: "Força!", ru: "Держись! / Давай!" },
          { pt: "Não faz mal.", ru: "Ничего страшного." },
          { pt: "Que pena!", ru: "Как жаль!" },
          { pt: "Fixe!", ru: "Класс! / Здорово!", note: "разговорное, только в Португалии" },
        ],
      },
    ],
  },

  pronouns: {
    label: "Местоимения и вопросы",
    icon: "🙋",
    lessons: [
      {
        id: "pronouns_1",
        label: "Часть 1 — Я, ты, он, она",
        theory: {
          intro:
            "В Португалии местоимение часто опускают: Sou russo вместо Eu sou russo — окончание глагола уже показывает лицо. Você в лицо незнакомцу звучит суховато — вежливее o senhor / a senhora.",
          tip: "Eu sou o Ivan. E a senhora, como se chama? — Я Иван. А вас как зовут? (вежливо к женщине)",
          sections: [
            {
              heading: "Единственное число",
              words: ["eu", "tu", "você", "ele", "ela", "o senhor / a senhora"],
            },
            { heading: "Множественное число", words: ["nós", "vocês", "eles", "elas"] },
          ],
        },
        words: [
          { pt: "eu", ru: "я" },
          { pt: "tu", ru: "ты", note: "к друзьям и близким" },
          { pt: "você", ru: "вы (к одному)", note: "нейтрально-прохладно; вежливее o senhor" },
          { pt: "ele", ru: "он" },
          { pt: "ela", ru: "она" },
          { pt: "nós", ru: "мы" },
          { pt: "vocês", ru: "вы (к нескольким)" },
          { pt: "eles", ru: "они (муж. или смешанные)" },
          { pt: "elas", ru: "они (жен.)" },
          { pt: "o senhor / a senhora", ru: "господин / госпожа", note: "вежливое «вы» к мужчине / к женщине" },
        ],
      },
      {
        id: "pronouns_2",
        label: "Часть 2 — Мой, твой, наш",
        theory: {
          intro:
            "Притяжательные согласуются с ВЕЩЬЮ, а не с владельцем: carro — мужского рода, поэтому o meu carro; casa — женского, поэтому a minha casa. Обычно с артиклем: o meu, a minha.",
          tip: "Este é o meu marido. — Это мой муж. A nossa casa é pequena. — Наш дом маленький. O carro dele. — Его машина.",
          sections: [
            {
              heading: "Чей?",
              words: ["meu / minha", "teu / tua", "seu / sua", "nosso / nossa", "dele / dela"],
            },
            { heading: "Этот и тот", words: ["este / esta", "esse / essa", "isto"] },
          ],
        },
        words: [
          { pt: "meu / minha", ru: "мой / моя", note: "o meu carro, a minha casa" },
          { pt: "teu / tua", ru: "твой / твоя" },
          { pt: "seu / sua", ru: "ваш / ваша (к você)", note: "«его/её» чаще dele/dela" },
          { pt: "nosso / nossa", ru: "наш / наша" },
          { pt: "dele / dela", ru: "его / её", note: "o carro dele = его машина" },
          { pt: "este / esta", ru: "этот / эта" },
          { pt: "esse / essa", ru: "тот / та (у собеседника)", note: "вдалеке — aquele / aquela" },
          { pt: "isto", ru: "это", note: "Isto é um livro. = Это книга." },
        ],
      },
      {
        id: "pronouns_3",
        label: "Часть 3 — Вопросительные слова",
        theory: {
          intro:
            "Главный инструмент выживания. В разговоре португальцы часто добавляют «é que»: Onde é que moras? = Onde moras? (Где живёшь?)",
          tip: "Quanto custa isto? — Сколько это стоит? Onde é a casa de banho? — Где туалет? Porquê? — Почему?",
          sections: [
            {
              heading: "Вопросы",
              words: ["quem", "o que", "onde", "quando", "como", "quanto", "qual", "porquê"],
            },
          ],
        },
        words: [
          { pt: "quem", ru: "кто", note: "Quem é? = Кто это?" },
          { pt: "o que", ru: "что", note: "O que é isto? = Что это?" },
          { pt: "onde", ru: "где", note: "Onde fica...? = Где находится...?" },
          { pt: "quando", ru: "когда" },
          { pt: "como", ru: "как", note: "Como está? = Как дела?" },
          { pt: "quanto", ru: "сколько", note: "Quanto custa? = Сколько стоит?" },
          { pt: "qual", ru: "какой / который", note: "Qual é o seu nome? = Как ваше имя?" },
          { pt: "porquê", ru: "почему", note: "в начале фразы — porque é que..." },
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
          tip: "Um café — один кофе. Uma água — одна вода. Dois copos — два стакана.",
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
          tip: "«Tenho vinte anos» — «Мне двадцать лет». Возраст всегда с глаголом ter (иметь).",
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
          { pt: "sessenta", ru: "шестьдесят" },
        ],
      },
      {
        id: "numbers_3",
        label: "Числа 70–90 и тысяча",
        theory: {
          intro:
            "Последние десятки: setenta (70), oitenta (80), noventa (90) — и mil (1000). Составные числа просто складываются: vinte e um — 21, trinta e cinco — 35.",
          tip: "Custa noventa euros. — Стоит девяносто евро. Mil euros?! É caro! — Тысяча евро?! Это дорого!",
          sections: [{ heading: "70–1000", words: ["setenta", "oitenta", "noventa", "mil"] }],
        },
        words: [
          { pt: "setenta", ru: "семьдесят" },
          { pt: "oitenta", ru: "восемьдесят" },
          { pt: "noventa", ru: "девяносто" },
          { pt: "mil", ru: "тысяча" },
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
          tip: "muito (очень) перед прилагательным не меняется: muito bom, muito boa. Перед существительным: muito calor, muita água.",
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
          { pt: "grande", ru: "большой" },
          { pt: "pequeno", ru: "маленький" },
          { pt: "novo", ru: "новый / молодой" },
          { pt: "velho", ru: "старый" },
          { pt: "caro", ru: "дорогой" },
          { pt: "barato", ru: "дешёвый" },
        ],
      },
      {
        id: "basics_2",
        label: "Часть 2 — Вид, время, место",
        theory: {
          intro:
            "Слова для описания вида, расположения во времени и пространстве. Hoje, amanhã, ontem — три слова, без которых не обходится ни один день.",
          tip: "Сегодня/завтра/вчера: hoje/amanhã/ontem. Ontem foi bom. — Вчера было хорошо.",
          sections: [
            { heading: "Вид", words: ["bonito", "feio"] },
            {
              heading: "Время и место",
              words: ["aqui", "ali", "agora", "hoje", "amanhã", "ontem", "sempre", "nunca"],
            },
          ],
        },
        words: [
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
      {
        id: "basics_3",
        label: "Часть 3 — Наречия-связки",
        theory: {
          intro:
            "Маленькие слова, которые склеивают речь: já (уже), ainda (ещё), também (тоже). Они встречаются почти в каждой фразе.",
          tip: "Também quero! — Я тоже хочу! Já percebo. — Уже понимаю. Tudo bem? — Всё хорошо?",
          sections: [
            { heading: "Время и порядок", words: ["já", "ainda", "depois", "antes"] },
            {
              heading: "Степень и связки",
              words: ["também", "talvez", "tudo", "nada", "só", "outro"],
            },
          ],
        },
        words: [
          { pt: "já", ru: "уже", note: "já não... = уже не..." },
          { pt: "ainda", ru: "ещё / всё ещё" },
          { pt: "depois", ru: "потом / после" },
          { pt: "antes", ru: "раньше / до" },
          { pt: "também", ru: "тоже / также" },
          { pt: "talvez", ru: "может быть" },
          { pt: "tudo", ru: "всё", note: "Tudo bem? = Всё хорошо?" },
          { pt: "nada", ru: "ничего", note: "не путать с De nada (не за что)" },
          { pt: "só", ru: "только" },
          { pt: "outro", ru: "другой", note: "outra = другая" },
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
          tip: "Sou russo. — Я русский. (ser)\nEstou cansado. — Я устал. (estar)\nEstou em Lisboa. — Я в Лиссабоне. (estar)",
          sections: [
            { heading: "Два глагола «быть»", words: ["ser", "estar"] },
            {
              heading: "Самые важные",
              words: ["ter", "fazer", "ir", "vir", "falar", "comer", "beber", "querer"],
            },
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
          tip: "trabalhar (работать) → eu trabalho. morar (жить) → eu moro em... Эти глаголы правильные, легко спрягаются.",
          sections: [
            { heading: "Модальные", words: ["poder", "saber", "precisar"] },
            {
              heading: "Бытовые",
              words: ["trabalhar", "morar", "gostar", "chamar-se", "comprar", "vender", "abrir"],
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
      {
        id: "verbs_3",
        label: "Часть 3 — Ещё десять важных",
        theory: {
          intro:
            "Ficar — главный глагол для «где находится»: Onde fica o hotel? Ещё десять глаголов, без которых не обойтись в быту.",
          tip: "Onde fica a estação? — Где находится вокзал? Fica perto. — Рядом. Espera um momento! — Подожди минутку!",
          sections: [
            { heading: "Самые нужные", words: ["ficar", "dar", "dizer", "ver"] },
            {
              heading: "Каждый день",
              words: ["ler", "escrever", "dormir", "pagar", "ajudar", "esperar"],
            },
          ],
        },
        words: [
          { pt: "ficar", ru: "находиться / оставаться", note: "Onde fica...? = где находится...?" },
          { pt: "dar", ru: "давать", note: "eu dou = я даю" },
          { pt: "dizer", ru: "сказать", note: "eu digo = я говорю" },
          { pt: "ver", ru: "видеть", note: "eu vejo = я вижу" },
          { pt: "ler", ru: "читать", note: "eu leio = я читаю" },
          { pt: "escrever", ru: "писать", note: "eu escrevo = я пишу" },
          { pt: "dormir", ru: "спать", note: "eu durmo = я сплю" },
          { pt: "pagar", ru: "платить", note: "eu pago = я плачу" },
          { pt: "ajudar", ru: "помогать", note: "eu ajudo = я помогаю" },
          { pt: "esperar", ru: "ждать / надеяться", note: "eu espero = я жду" },
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
          tip: "Tenho um irmão. — У меня есть брат. Não tenho filhos. — У меня нет детей. Глагол ter (иметь) для семьи.",
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
          { pt: "tio", ru: "дядя" },
          { pt: "tia", ru: "тётя" },
          { pt: "primo", ru: "двоюродный брат" },
          { pt: "prima", ru: "двоюродная сестра" },
        ],
      },
      {
        id: "family_2",
        label: "Люди вокруг",
        theory: {
          intro:
            "Не только семья: друзья, дети, просто люди. Amigo/amiga — друг/подруга, namorado/namorada — парень/девушка.",
          tip: "Este é o meu amigo João. — Это мой друг Жуан. A pessoa — всегда женского рода, даже о мужчине.",
          sections: [
            { heading: "Свои люди", words: ["amigo", "amiga", "namorado", "namorada"] },
            { heading: "Люди вообще", words: ["homem", "criança", "bebé", "pessoa"] },
          ],
        },
        words: [
          { pt: "amigo", ru: "друг" },
          { pt: "amiga", ru: "подруга" },
          { pt: "namorado", ru: "парень (в отношениях)", note: "o meu namorado = мой парень" },
          { pt: "namorada", ru: "девушка (в отношениях)" },
          { pt: "homem", ru: "мужчина", note: "женщина = mulher (тема «Семья»)" },
          { pt: "criança", ru: "ребёнок" },
          { pt: "bebé", ru: "младенец", note: "в Португалии bebé, в Бразилии bebê" },
          { pt: "pessoa", ru: "человек", note: "всегда жен. род: a pessoa" },
        ],
      },
    ],
  },

  about: {
    label: "О себе",
    icon: "🌍",
    lessons: [
      {
        id: "about_1",
        label: "Страны и языки",
        theory: {
          intro:
            "Национальность и язык — одно слово: russo — это и русский человек, и русский язык. Sou russo. Falo russo. Названия языков пишутся с маленькой буквы.",
          tip: "De onde é? — Sou da Rússia, mas moro em Lisboa. — Откуда вы? — Я из России, но живу в Лиссабоне.",
          sections: [
            {
              heading: "Страны и города",
              words: ["Portugal", "Rússia", "Lisboa", "país", "cidade", "estrangeiro"],
            },
            { heading: "Языки и национальности", words: ["português", "russo", "inglês", "língua"] },
          ],
        },
        words: [
          { pt: "Portugal", ru: "Португалия" },
          { pt: "Rússia", ru: "Россия" },
          { pt: "Lisboa", ru: "Лиссабон" },
          { pt: "país", ru: "страна", note: "муж. род: o país" },
          { pt: "cidade", ru: "город" },
          { pt: "estrangeiro", ru: "иностранец / заграница", note: "no estrangeiro = за границей" },
          { pt: "português", ru: "португальский / португалец", note: "portuguesa = португалка" },
          { pt: "russo", ru: "русский", note: "russa = русская; язык тоже russo" },
          { pt: "inglês", ru: "английский / англичанин" },
          { pt: "língua", ru: "язык", note: "Que línguas fala? = Какие языки знаете?" },
        ],
      },
      {
        id: "about_2",
        label: "Работа и учёба",
        theory: {
          intro:
            "Обычный смолток: Onde trabalha? — Где работаете? Trabalho numa empresa. — Работаю в компании. Trabalho — и «работа», и «я работаю».",
          tip: "Estou de férias! — Я в отпуске! Tenho aulas de português. — У меня уроки португальского.",
          sections: [
            { heading: "Работа", words: ["trabalho", "escritório", "empresa", "colega", "férias"] },
            {
              heading: "Учёба",
              words: ["escola", "universidade", "professor", "estudante", "aula"],
            },
          ],
        },
        words: [
          { pt: "trabalho", ru: "работа", note: "eu trabalho = я работаю — то же слово" },
          { pt: "escritório", ru: "офис" },
          { pt: "empresa", ru: "компания / фирма" },
          { pt: "colega", ru: "коллега", note: "общий род: o/a colega" },
          { pt: "férias", ru: "отпуск / каникулы", note: "всегда мн. ч.: as férias" },
          { pt: "escola", ru: "школа" },
          { pt: "universidade", ru: "университет" },
          { pt: "professor", ru: "учитель / преподаватель", note: "professora = учительница" },
          { pt: "estudante", ru: "студент / студентка" },
          { pt: "aula", ru: "урок / занятие", note: "aula de português = урок португальского" },
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
        label: "Цвета",
        theory: {
          intro:
            "Цвета согласуются с родом: carro vermelho (красная машина), casa vermelha. Исключения без изменений: azul, verde, laranja, cor-de-rosa.",
          tip: "O carro é vermelho. — Машина красная. Ela tem olhos azuis. — У неё голубые глаза. (ter = иметь)",
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
          tip: "Ele é alto. — Он высокий. Ela é alta. — Она высокая. Обратите внимание на окончание!",
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
          tip: "Um café = эспрессо. Galão = большой кофе с молоком. Pastel de nata — обязательно попробуй!",
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
          tip: "Vinho verde — молодое белое вино, символ Португалии. Cerveja — пиво. «A conta, por favor» — счёт.",
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

  restaurant: {
    label: "Ресторан и продукты",
    icon: "🍴",
    lessons: [
      {
        id: "restaurant_1",
        label: "Продукты",
        theory: {
          intro:
            "Базовая продуктовая корзина. Azeite — оливковое масло, гордость Португалии: им поливают всё, от салата до трески.",
          tip: "Pão com manteiga e um galão — классический португальский завтрак за пару евро.",
          sections: [
            { heading: "Основное", words: ["carne", "ovo", "queijo", "manteiga", "azeite"] },
            { heading: "Из магазина", words: ["sal", "açúcar", "batata", "tomate", "maçã"] },
          ],
        },
        words: [
          { pt: "carne", ru: "мясо" },
          { pt: "ovo", ru: "яйцо" },
          { pt: "queijo", ru: "сыр" },
          { pt: "manteiga", ru: "сливочное масло" },
          { pt: "azeite", ru: "оливковое масло", note: "гордость Португалии" },
          { pt: "sal", ru: "соль" },
          { pt: "açúcar", ru: "сахар" },
          { pt: "batata", ru: "картофель" },
          { pt: "tomate", ru: "помидор" },
          { pt: "maçã", ru: "яблоко" },
        ],
      },
      {
        id: "restaurant_2",
        label: "За столом",
        theory: {
          intro:
            "В ресторане первым делом приносят couvert — хлеб, оливки, масло. Он платный! Не хочешь — вежливо откажись, это нормально.",
          tip: "A ementa, se faz favor. — Меню, пожалуйста. O prato do dia é bacalhau. — Блюдо дня — треска.",
          sections: [
            {
              heading: "Посуда и приборы",
              words: ["prato", "copo", "garfo", "faca", "colher", "garrafa"],
            },
            { heading: "В ресторане", words: ["ementa", "empregado", "bacalhau", "pastel de nata"] },
          ],
        },
        words: [
          { pt: "prato", ru: "тарелка / блюдо", note: "prato do dia = блюдо дня" },
          { pt: "copo", ru: "стакан / бокал" },
          { pt: "garfo", ru: "вилка" },
          { pt: "faca", ru: "нож" },
          { pt: "colher", ru: "ложка" },
          { pt: "garrafa", ru: "бутылка", note: "uma garrafa de água = бутылка воды" },
          { pt: "ementa", ru: "меню", note: "в Португалии ementa; menu — комплексный обед" },
          { pt: "empregado", ru: "официант", note: "полностью: empregado de mesa; подзывают: se faz favor!" },
          { pt: "bacalhau", ru: "треска", note: "национальное блюдо — говорят, 365 рецептов" },
          { pt: "pastel de nata", ru: "пирожное с заварным кремом", note: "главный десерт страны" },
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
          tip: "«Que dia é hoje?» — Какой сегодня день? «Hoje é quarta-feira.» — Сегодня среда.",
          sections: [
            {
              heading: "Дни недели",
              words: ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"],
            },
            { heading: "Неделя", words: ["dia", "semana", "fim de semana"] },
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
          tip: "Manhã = утро. Tarde = день/вечер. Noite = ночь. De manhã = утром. À tarde = днём/вечером.",
          sections: [
            { heading: "Части суток", words: ["manhã", "tarde", "noite", "meio-dia", "meia-noite"] },
            { heading: "Время", words: ["hora", "minuto", "mês", "ano", "cedo", "logo", "Que horas são?"] },
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
          { pt: "logo", ru: "позже / скоро", note: "até logo = до скорого" },
          { pt: "Que horas são?", ru: "Который час?" },
        ],
      },
    ],
  },

  calendar: {
    label: "Календарь",
    icon: "🗓️",
    lessons: [
      {
        id: "calendar_1",
        label: "Месяцы",
        theory: {
          intro:
            "Месяцы, как и дни недели, пишутся с маленькой буквы. «В мае» = em maio. Дата: a 5 de maio — 5 мая.",
          tip: "O meu aniversário é em maio. — Мой день рождения в мае. Junho и julho легко перепутать — junho раньше!",
          sections: [
            {
              heading: "Первое полугодие",
              words: ["janeiro", "fevereiro", "março", "abril", "maio", "junho"],
            },
            {
              heading: "Второе полугодие",
              words: ["julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
            },
          ],
        },
        words: [
          { pt: "janeiro", ru: "январь" },
          { pt: "fevereiro", ru: "февраль" },
          { pt: "março", ru: "март" },
          { pt: "abril", ru: "апрель" },
          { pt: "maio", ru: "май" },
          { pt: "junho", ru: "июнь" },
          { pt: "julho", ru: "июль" },
          { pt: "agosto", ru: "август" },
          { pt: "setembro", ru: "сентябрь" },
          { pt: "outubro", ru: "октябрь" },
          { pt: "novembro", ru: "ноябрь" },
          { pt: "dezembro", ru: "декабрь" },
        ],
      },
      {
        id: "calendar_2",
        label: "Сезоны и праздники",
        theory: {
          intro:
            "Времена года — с маленькой буквы, праздники — с большой. «Летом» = no verão, «зимой» = no inverno.",
          tip: "Feliz aniversário! — С днём рождения! O Natal em Portugal — это bacalhau и bolo-rei на столе.",
          sections: [
            { heading: "Времена года", words: ["primavera", "verão", "outono", "inverno"] },
            {
              heading: "Праздники и даты",
              words: ["data", "aniversário", "festa", "feriado", "Natal", "Páscoa"],
            },
          ],
        },
        words: [
          { pt: "primavera", ru: "весна" },
          { pt: "verão", ru: "лето" },
          { pt: "outono", ru: "осень" },
          { pt: "inverno", ru: "зима" },
          { pt: "data", ru: "дата" },
          { pt: "aniversário", ru: "день рождения", note: "Feliz aniversário! = С днём рождения!" },
          { pt: "festa", ru: "праздник / вечеринка" },
          { pt: "feriado", ru: "выходной / нерабочий день" },
          { pt: "Natal", ru: "Рождество", note: "Feliz Natal! = Счастливого Рождества!" },
          { pt: "Páscoa", ru: "Пасха" },
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
          tip: "В Лиссабоне: Baixa — центр, Alfama — старый квартал, Belém — район с башней.",
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
          tip: "В Лиссабоне: eléctrico (трамвай 28!), metro, autocarro, ferry через реку Тежу.",
          sections: [
            { heading: "Транспорт", words: ["autocarro", "metro", "comboio", "táxi", "carro", "avião", "barco"] },
            {
              heading: "Направления",
              words: ["direita", "esquerda", "em frente", "perto", "longe"],
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
          { pt: "perto", ru: "близко / рядом", note: "perto de... = рядом с..." },
          { pt: "longe", ru: "далеко", note: "longe de... = далеко от..." },
        ],
      },
    ],
  },

  shopping: {
    label: "Деньги и покупки",
    icon: "🛒",
    lessons: [
      {
        id: "shopping_1",
        label: "Деньги и оплата",
        theory: {
          intro:
            "Multibanco — и банкомат, и главная платёжная система Португалии, работает везде. Posso pagar com cartão? — Можно картой?",
          tip: "Quanto custa? — Сколько стоит? São três euros e cinquenta. — Три евро пятьдесят.",
          sections: [
            { heading: "Деньги", words: ["dinheiro", "euro", "cêntimo", "preço", "grátis"] },
            { heading: "Оплата", words: ["cartão", "troco", "recibo", "multibanco", "caixa"] },
          ],
        },
        words: [
          { pt: "dinheiro", ru: "деньги" },
          { pt: "euro", ru: "евро" },
          { pt: "cêntimo", ru: "цент", note: "в Португалии cêntimo, не centavo" },
          { pt: "preço", ru: "цена" },
          { pt: "grátis", ru: "бесплатно" },
          { pt: "cartão", ru: "банковская карта", note: "pagar com cartão = платить картой" },
          { pt: "troco", ru: "сдача" },
          { pt: "recibo", ru: "чек / квитанция" },
          { pt: "multibanco", ru: "банкомат", note: "главная платёжная система страны" },
          { pt: "caixa", ru: "касса" },
        ],
      },
      {
        id: "shopping_2",
        label: "Магазины",
        theory: {
          intro:
            "Вывески, которые встречаются каждый день: aberto (открыто), fechado (закрыто), saldos (распродажа — январь и июль).",
          tip: "На кассе всегда спросят: Quer um saco? — Пакет нужен? O mercado abre às sete. — Рынок открывается в семь.",
          sections: [
            { heading: "Куда идём", words: ["loja", "mercado", "padaria", "talho"] },
            {
              heading: "В магазине",
              words: ["saco", "fila", "aberto", "fechado", "saldos", "presente"],
            },
          ],
        },
        words: [
          { pt: "loja", ru: "магазин" },
          { pt: "mercado", ru: "рынок" },
          { pt: "padaria", ru: "булочная / пекарня" },
          { pt: "talho", ru: "мясная лавка", note: "в Бразилии — açougue" },
          { pt: "saco", ru: "пакет", note: "Quer um saco? = Пакет нужен?" },
          { pt: "fila", ru: "очередь" },
          { pt: "aberto", ru: "открыто" },
          { pt: "fechado", ru: "закрыто" },
          { pt: "saldos", ru: "распродажа", note: "всегда мн. ч.; январь и июль" },
          { pt: "presente", ru: "подарок" },
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
          tip: "112 — номер скорой в Португалии. Preciso de um médico. — Мне нужен врач. Chame uma ambulância! — Вызовите скорую!",
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
          tip: "В аптеке (farmácia): Tem aspirina? — Есть аспирин? Tenho dores de cabeça. — У меня болит голова.",
          sections: [
            {
              heading: "Здоровье",
              words: ["médico", "comprimido", "febre", "dor", "doente", "cansado", "alérgico", "ambulância"],
            },
            { heading: "Ещё части тела", words: ["perna", "cabelo"] },
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
          tip: "rés-do-chão = ground floor (первый этаж у нас). primeiro andar = второй этаж. Важно в отелях!",
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
          { pt: "jardim", ru: "сад" },
          { pt: "cadeira", ru: "стул" },
          { pt: "sofá", ru: "диван" },
          { pt: "televisão", ru: "телевизор" },
        ],
      },
      {
        id: "home_2",
        label: "Вещи и предметы",
        theory: {
          intro:
            "Предметы в доме. Ter (иметь) для описания вещей: Tenho um computador. — У меня есть компьютер.",
          tip: "Слова совпадают с русским: computador, televisão, telefone. Португальский близок к другим Romance языкам.",
          sections: [
            {
              heading: "Предметы",
              words: ["computador", "telefone", "telemóvel", "relógio", "chave", "livro", "roupa", "frigorífico"],
            },
          ],
        },
        words: [
          { pt: "computador", ru: "компьютер" },
          { pt: "telefone", ru: "телефон (стационарный)" },
          { pt: "chave", ru: "ключ" },
          { pt: "livro", ru: "книга" },
          { pt: "roupa", ru: "одежда" },
          { pt: "frigorífico", ru: "холодильник" },
          { pt: "telemóvel", ru: "мобильный телефон", note: "в Португалии telemóvel, не celular" },
          { pt: "relógio", ru: "часы (прибор)" },
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
          tip: "Лиссабон — 2800+ солнечных часов в год. Que dia bonito! — Какой красивый день! Está a chover. — Идёт дождь.",
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
          { pt: "rio", ru: "река" },
          { pt: "montanha", ru: "гора" },
          { pt: "praia", ru: "пляж" },
          { pt: "floresta", ru: "лес" },
          { pt: "céu", ru: "небо" },
        ],
      },
    ],
  },

  feelings: {
    label: "Чувства и состояния",
    icon: "🙂",
    lessons: [
      {
        id: "feelings_1",
        label: "Чувства и состояния",
        theory: {
          intro:
            "Временные состояния — с estar: Estou feliz. Голод, жажда, страх — через ter: Tenho fome (дословно «имею голод»).",
          tip: "Estou muito contente! — Я очень доволен! Tenho saudades de casa. — Скучаю по дому.",
          sections: [
            {
              heading: "Состояния (estar)",
              words: ["feliz", "triste", "contente", "zangado", "nervoso"],
            },
            { heading: "Через ter", words: ["fome", "sede", "sono", "medo", "saudade"] },
          ],
        },
        words: [
          { pt: "feliz", ru: "счастливый" },
          { pt: "triste", ru: "грустный" },
          { pt: "contente", ru: "довольный" },
          { pt: "zangado", ru: "сердитый" },
          { pt: "nervoso", ru: "нервный / взволнованный" },
          { pt: "fome", ru: "голод", note: "Tenho fome. = Я голоден." },
          { pt: "sede", ru: "жажда", note: "Tenho sede. = Хочу пить." },
          { pt: "sono", ru: "сонливость", note: "Tenho sono. = Хочу спать." },
          { pt: "medo", ru: "страх", note: "Tenho medo de... = Я боюсь..." },
          { pt: "saudade", ru: "тоска / ностальгия", note: "Tenho saudades tuas. = Скучаю по тебе." },
        ],
      },
    ],
  },

  clothes: {
    label: "Одежда",
    icon: "👕",
    lessons: [
      {
        id: "clothes_1",
        label: "Одежда и обувь",
        theory: {
          intro:
            "Многие названия — всегда во множественном числе: as calças (брюки), os óculos (очки). Примерить: Posso experimentar? — Можно примерить?",
          tip: "Que tamanho? — Какой размер? Camisola в Португалии — свитер, а в Бразилии — ночная рубашка!",
          sections: [
            {
              heading: "Одежда",
              words: ["camisa", "calças", "vestido", "saia", "camisola", "casaco"],
            },
            { heading: "Обувь и аксессуары", words: ["sapatos", "sapatilhas", "chapéu", "óculos"] },
          ],
        },
        words: [
          { pt: "camisa", ru: "рубашка" },
          { pt: "calças", ru: "брюки", note: "всегда мн. ч.: as calças" },
          { pt: "vestido", ru: "платье" },
          { pt: "saia", ru: "юбка" },
          { pt: "camisola", ru: "свитер / кофта", note: "в Бразилии значит другое!" },
          { pt: "casaco", ru: "куртка / пальто" },
          { pt: "sapatos", ru: "туфли / обувь", note: "um sapato = один ботинок" },
          { pt: "sapatilhas", ru: "кроссовки", note: "в Бразилии — tênis" },
          { pt: "chapéu", ru: "шляпа / головной убор" },
          { pt: "óculos", ru: "очки", note: "óculos de sol = солнечные очки" },
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
          tip: "Португальцы очень ценят попытки говорить по-португальски. Улыбнись и скажи «Não percebo» — обязательно помогут.",
          sections: [
            {
              heading: "Непонимание",
              words: ["Não percebo.", "Pode repetir?", "Mais devagar, por favor.", "Como se diz...?", "Não falo bem português.", "Fala inglês?"],
            },
            {
              heading: "Помощь",
              words: ["Preciso de ajuda.", "Pode ajudar-me?", "Onde é...?", "Como chego a...?", "Tem...?"],
            },
            {
              heading: "Покупки и знакомство",
              words: ["Quanto custa?", "A conta, por favor.", "De onde é?"],
            },
            { heading: "Реакции", words: ["Não sei.", "Está bem."] },
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
          { pt: "Onde é...?", ru: "Где находится...?" },
          { pt: "Como chego a...?", ru: "Как добраться до...?" },
          { pt: "Tem...?", ru: "У вас есть...?" },
          { pt: "Fala inglês?", ru: "Вы говорите по-английски?" },
          { pt: "Não sei.", ru: "Я не знаю." },
          { pt: "Está bem.", ru: "Хорошо. / Ладно.", note: "не путать с Estou bem. (я в порядке)" },
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
  { words: ["A", "conta", "são", "vinte", "euros."], answer: "A conta são vinte euros.", ru: "Счёт — двадцать евро.", required: ["conta", "vinte"] },
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
  // greetings + pronouns
  { words: ["Olá!", "Como", "está", "a", "senhora?"], answer: "Olá! Como está a senhora?", ru: "Здравствуйте! Как вы поживаете? (к женщине)", required: ["Olá", "Como está?", "o senhor / a senhora"] },
  { words: ["O", "que", "é", "isto?"], answer: "O que é isto?", ru: "Что это?", required: ["o que", "isto"] },
  // basics (наречия-связки)
  { words: ["Agora", "já", "percebo", "tudo!"], answer: "Agora já percebo tudo!", ru: "Теперь я уже всё понимаю!", required: ["agora", "já", "tudo"] },
  { words: ["Talvez", "depois,", "agora", "não."], answer: "Talvez depois, agora não.", ru: "Может быть, потом — сейчас нет.", required: ["talvez", "depois", "agora", "não"] },
  // pronouns + verbs
  { words: ["Eu", "não", "vejo", "nada."], answer: "Eu não vejo nada.", ru: "Я ничего не вижу.", required: ["eu", "ver", "nada"] },
  { words: ["Vou", "dormir.", "Boa", "noite!"], answer: "Vou dormir. Boa noite!", ru: "Иду спать. Спокойной ночи!", required: ["ir", "dormir", "Boa noite"] },
  // family (люди) + pronouns
  { words: ["Este", "é", "o", "meu", "amigo."], answer: "Este é o meu amigo.", ru: "Это мой друг.", required: ["este / esta", "meu / minha", "amigo", "ser"] },
  { words: ["A", "senhora", "tem", "filhos?"], answer: "A senhora tem filhos?", ru: "У вас есть дети? (вежливо)", required: ["o senhor / a senhora", "ter", "filho"] },
  // about (страны, языки, работа)
  { words: ["Falo", "russo", "e", "um", "pouco", "de", "português."], answer: "Falo russo e um pouco de português.", ru: "Я говорю по-русски и немного по-португальски.", required: ["falar", "russo", "pouco", "português"] },
  { words: ["Trabalho", "numa", "empresa", "em", "Lisboa."], answer: "Trabalho numa empresa em Lisboa.", ru: "Я работаю в компании в Лиссабоне.", required: ["trabalhar", "empresa", "Lisboa"] },
  { words: ["Amanhã", "estou", "de", "férias!"], answer: "Amanhã estou de férias!", ru: "Завтра я в отпуске!", required: ["amanhã", "estar", "férias"] },
  // restaurant + food
  { words: ["Quero", "bacalhau", "e", "um", "copo", "de", "vinho."], answer: "Quero bacalhau e um copo de vinho.", ru: "Хочу треску и бокал вина.", required: ["querer", "bacalhau", "copo", "vinho"] },
  { words: ["A", "ementa,", "por", "favor."], answer: "A ementa, por favor.", ru: "Меню, пожалуйста.", required: ["ementa", "Por favor"] },
  { words: ["Um", "pastel", "de", "nata", "e", "um", "café."], answer: "Um pastel de nata e um café.", ru: "Одно пирожное ната и один кофе.", required: ["pastel de nata", "café"] },
  { words: ["Quero", "outro", "café,", "por", "favor."], answer: "Quero outro café, por favor.", ru: "Хочу ещё один кофе, пожалуйста.", required: ["querer", "outro", "café", "Por favor"] },
  // calendar
  { words: ["O", "meu", "aniversário", "é", "em", "outubro."], answer: "O meu aniversário é em outubro.", ru: "Мой день рождения в октябре.", required: ["aniversário", "outubro", "meu / minha"] },
  { words: ["O", "Natal", "é", "em", "dezembro."], answer: "O Natal é em dezembro.", ru: "Рождество в декабре.", required: ["Natal", "dezembro", "ser"] },
  { words: ["No", "verão", "vou", "à", "praia."], answer: "No verão vou à praia.", ru: "Летом я хожу на пляж.", required: ["verão", "ir", "praia"] },
  // shopping + numbers
  { words: ["Quanto", "custa?", "São", "dez", "euros."], answer: "Quanto custa? São dez euros.", ru: "Сколько стоит? Десять евро.", required: ["Quanto custa?", "dez", "euro"] },
  { words: ["Posso", "pagar", "com", "cartão?"], answer: "Posso pagar com cartão?", ru: "Могу я заплатить картой?", required: ["poder", "pagar", "cartão"] },
  { words: ["O", "mercado", "está", "fechado", "hoje."], answer: "O mercado está fechado hoje.", ru: "Рынок сегодня закрыт.", required: ["mercado", "fechado", "hoje", "estar"] },
  { words: ["A", "conta", "são", "setenta", "euros."], answer: "A conta são setenta euros.", ru: "Счёт — семьдесят евро.", required: ["conta", "setenta", "euro"] },
  // home + feelings
  { words: ["O", "telemóvel", "está", "na", "mesa."], answer: "O telemóvel está na mesa.", ru: "Телефон на столе.", required: ["telemóvel", "mesa", "estar"] },
  { words: ["Estou", "feliz", "porque", "hoje", "é", "sexta-feira."], answer: "Estou feliz porque hoje é sexta-feira.", ru: "Я счастлив, потому что сегодня пятница.", required: ["feliz", "porque", "sexta-feira", "estar"] },
  { words: ["Tenho", "fome", "e", "sede."], answer: "Tenho fome e sede.", ru: "Я хочу есть и пить.", required: ["ter", "fome", "sede"] },
  { words: ["Tenho", "saudades", "de", "casa."], answer: "Tenho saudades de casa.", ru: "Я скучаю по дому.", required: ["saudade", "casa", "ter"] },
  // clothes + colors
  { words: ["A", "camisa", "branca", "é", "cara."], answer: "A camisa branca é cara.", ru: "Белая рубашка дорогая.", required: ["camisa", "branco", "caro", "ser"] },
  { words: ["Onde", "estão", "os", "meus", "óculos?"], answer: "Onde estão os meus óculos?", ru: "Где мои очки?", required: ["onde", "óculos", "meu / minha", "estar"] },
  // phrases
  { words: ["Fala", "inglês?", "Não,", "desculpe."], answer: "Fala inglês? Não, desculpe.", ru: "Вы говорите по-английски? Нет, извините.", required: ["Fala inglês?", "não", "Desculpe"] },
  { words: ["Está", "bem,", "até", "amanhã!"], answer: "Está bem, até amanhã!", ru: "Хорошо, до завтра!", required: ["Está bem.", "Até amanhã"] },
];
