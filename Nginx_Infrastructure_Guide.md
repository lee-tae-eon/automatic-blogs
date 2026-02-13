# 🛡️ Nginx & 인프라 마스터 가이드 (Pro Version)

기본적인 리버스 프록시를 넘어, 실제 서비스 운영 환경(Production)에서 필수적으로 적용하는 고급 설정들입니다.

---

## 1. ⚡ 성능 최적화 (Performance)

### Gzip 압축 (Data Compression)
텍스트 데이터를 압축해서 전송하여 네트워크 대역폭을 절약하고 로딩 속도를 비약적으로 높입니다.
```nginx
http {
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000; # 1KB 이상의 파일만 압축
}
```

### 정적 파일 캐싱 (Browser Caching)
이미지, 폰트 등 잘 변하지 않는 파일은 접속자의 브라우저에 저장시켜 서버 부하를 줄입니다.
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d; # 7일 동안 캐시 유지
    add_header Cache-Control "public, no-transform";
}
```

---

## 2. 🔐 보안 강화 (Security Hardening)

### 서버 정보 은닉 (Hiding Version)
에러 페이지 등에서 Nginx 버전을 숨겨 해커가 취약점을 찾는 것을 방해합니다.
```nginx
http {
    server_tokens off;
}
```

### 접속 횟수 제한 (Rate Limiting)
특정 IP에서 과도하게 요청을 보내는 공격(Brute-force, DDOS)을 차단합니다.
```nginx
http {
    limit_req_zone $binary_remote_addr zone=mylimit:10m rate=5r/s; # 초당 5번 제한
}

server {
    location / {
        limit_req zone=mylimit burst=10; # 순간적인 10번까지는 허용
        proxy_pass http://localhost:1216;
    }
}
```

---

## 3. 🚦 실무형 리버스 프록시 템플릿 (Best Practice)

GCP/AWS 환경에서 흔히 사용하는 '완전체' 설정 예시입니다.

```nginx
# /opt/homebrew/etc/nginx/servers/blog-automation.conf

server {
    listen 80;
    server_name localhost;

    # 로그 설정 (누가 들어왔는지 정밀 기록)
    access_log /opt/homebrew/var/log/nginx/blog_access.log;
    error_log  /opt/homebrew/var/log/nginx/blog_error.log;

    location / {
        # 1. 실제 서버로 전달
        proxy_pass http://localhost:1216;

        # 2. 프로토콜 최적화
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # 3. 실제 접속자 정보 보존 (GCP 인프라 핵심)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 4. 타임아웃 설정 (AI 생성 시 길어질 수 있음)
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # 특정 IP만 허용하고 싶을 때 (White-list)
    # allow 192.168.0.1;
    # deny all;
}
```

---

## 4. 🛠️ 인프라 운영 꿀팁
*   **설정 테스트**: `nginx -t` (파일을 고칠 때마다 습관적으로 수행)
*   **무중단 적용**: `nginx -s reload` (서버를 끄지 않고 설정만 즉시 반영)
*   **실시간 로그 감시**: `tail -f /opt/homebrew/var/log/nginx/access.log` (누가 들어오는지 실시간으로 구경하기)

---
*Created on: 2026-02-13*
*Updated with Pro features for Obsidian*
