# Релизы WHM через GitHub и Coolify

Оба домена пока используются для разработки. Ветки обозначают ступени релиза, финальные production-домены будут перенесены отдельно.

| Ветка | Окружение | Домен |
|---|---|---|
| `develop` | staging | https://test-whm.pikman.studio |
| `main` | production | https://whm.pikman.studio |

Идентификаторы ресурсов: `infra/coolify/environments.json`. Coolify 4.3.23 на VM `ada`. GitHub App уже подключена к `jeune-toujours/whm-d`; отдельный staging frontend подключён к `develop`. Секреты остаются вне Git.

## Работа агента

1. Прочитать `AGENTS.md`, master plan и продуктовую спецификацию.
2. Создать рабочую ветку и PR в `develop`. Проверить `client` и `backend` в GitHub Actions.
3. После проверок merge в `develop` вызывает GitHub App → Coolify staging.
4. Проверить **finished** статус deployment, HTTPS, `/health` и `/release.json` с SHA коммита. Один ответ `queued` не означает успешный релиз.
5. Для продвижения создать PR `develop` → `main`. После проверки staging и CI merge публикует `main`.
6. Для отката использовать предыдущий образ Coolify или revert-коммит. Образ приложения не откатывает PostgreSQL. Не делать автоматический `migrate:down` с пользовательскими данными.

GitHub App запускает deploy непосредственно на push. CI проверяет PR; обязательность проверок при merge требует branch protection. Не считать push в защищённую ветку альтернативой проверкам.

## Ручной релиз через агента

API-токен находится на VM: `/home/pavel/.config/whm/coolify-token`, владелец `pavel`, права `600`. Использовать API localhost по SSH; не отправлять токен через публичный HTTP и не передавать аргументом командной строки.

После обновления серверного checkout:

```bash
python3 scripts/coolify.py list
python3 scripts/coolify.py deploy staging
python3 scripts/coolify.py status staging
```

С локальной машины использовать SSH config владельца. В текущей конфигурации alias — `whm`:

```powershell
ssh -F C:/Users/pashr/.ssh/config whm
```

`scripts/release.mjs` подходит для CI или HTTPS панели: токен передаётся переменной окружения `COOLIFY_TOKEN`, URL — `COOLIFY_URL`, UUID приложений — `COOLIFY_STAGING_APPS` / `COOLIFY_PRODUCTION_APPS`. Не записывать их значения в команды или документы.

## Deployment backend

До запуска нужны отдельные Selectel базы/credentials и S3 bucket либо prefix для каждого окружения. В Coolify: build pack Dockerfile, context `/backend`, Dockerfile `/Dockerfile`, порт `3000`, runtime env из `backend/.env.example`. Токен Coolify не является паролем PostgreSQL или S3-ключом.

При общем домене routes `/api`, `/admin`, `/_next` направляются в backend, остальные — во frontend. **Strip Prefixes выключить**: Payload ожидает полные пути. Включить передачу `SOURCE_COMMIT` и readiness `/api/ready`. Проверить, что API отвечает JSON и админка загружает Next assets, а не статический `index.html`.

Миграция выполняется автоматически из **нового образа** до запуска Next: `start.sh` → `npm run migrate:deploy` → `server.js`. PostgreSQL advisory lock сериализует миграции; история schema push блокирует запуск и требует проверки. CI применяет миграции дважды, чтобы проверить повторный запуск. Существующие данные — только совместимые расширения схемы; удаление полей отдельным релизом. В Coolify не использовать pre-deploy exec в старом контейнере для новых миграций. Frontend переключается на live после проверки readiness и реализации клиентских сценариев.

### Настройки Selectel staging

Исходный файл владельца: `/home/pavel/.config/whm/staging.env`, права `600`. Адаптированный файл: `/home/pavel/.config/whm/staging.runtime.env`, также `600`. Секреты загружаются по localhost API Coolify на VM, `is_buildtime=false`, `is_runtime=true`; в Docker build credentials не передаются.

- Endpoint S3 дополняется `https://`; изолированный prefix `staging`.
- `APP_URL` и `CLIENT_URL` — `https://test-whm.pikman.studio`. Имена `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `PAYLOAD_PUBLIC_SERVER_URL` из исходного файла заменяются настройками приложения.
- PostgreSQL: `DATABASE_SSL=true`, `DATABASE_CA` содержит PEM из официального `https://storage.dbaas.selcloud.ru/CA.pem`. `DATABASE_CA_FILE` поддерживается для локальной работы. Проверка цепочки и имени сертификата включена. SSL-параметры URL не могут отключить явно включённый TLS.
- `DATABASE_PUSH=false`, `APP_ENV=staging`. Настройки production должны использовать отдельную базу и prefix/credentials.

Сертификат и инструкции: [Selectel PostgreSQL](https://docs.selectel.ru/managed-databases/postgresql/connect-to-cluster/). Поведение SSL URL: [node-postgres](https://node-postgres.com/features/ssl).

## Текущее состояние

Первый frontend релиз на `main` выполнен владельцем. Staging frontend уже развёрнут из `develop`. Создан отдельный staging backend; PostgreSQL Selectel проверен через TLS, S3 доступен. Статус конкретного backend deployment проверять через `scripts/coolify.py status staging` и `/api/ready`; эта документация не заменяет проверку завершённого релиза. Клиент пока работает в demo до реализации API-сценариев.

[Coolify GitHub App](https://coolify.io/docs/applications/sources/github/overview), [routing](https://coolify.io/docs/core/networking/domains), [deployment API](https://coolify.io/docs/api/endpoints/deployments/deploy-by-tag-or-uuid).
