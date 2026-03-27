# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - alert [ref=e11]
  - generic:
    - generic:
      - heading [level=2]
      - paragraph
  - generic [ref=e12]:
    - banner [ref=e13]:
      - img "Deploy(it) Logo" [ref=e14]
    - generic [ref=e17]:
      - heading "Sign In" [level=1] [ref=e18]
      - paragraph [ref=e19]: to access your DevOps Lab
      - generic [ref=e21]: Invalid email or password
      - generic [ref=e22]:
        - generic [ref=e23]:
          - generic [ref=e24]: Email Address
          - textbox "Your Email" [ref=e25]: system-admin@deployit.com
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]: Password
            - button "Forgot Password?" [ref=e29] [cursor=pointer]
          - textbox "••••••••" [ref=e30]: admin123
        - button "Login" [ref=e31] [cursor=pointer]
      - button "Don't have an account? Sign Up" [ref=e33] [cursor=pointer]
```