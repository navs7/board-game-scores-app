# Auth Testing Playbook

## MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.getIndexes()
```

Verify:
- bcrypt hash starts with `$2b$`
- unique index on users.email
- index on login_attempts.identifier
- TTL index on password_reset_tokens.expires_at

## API Testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@boardgame.app","password":"admin123"}'

cat cookies.txt

curl -b cookies.txt http://localhost:8001/api/auth/me
```

Login should:
- Return user object (no password_hash)
- Set `access_token` + `refresh_token` cookies

`/me` should return same user using those cookies.

Brute force: 5 failed logins from same IP+email = 15 min lockout.
