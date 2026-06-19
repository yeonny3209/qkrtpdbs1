def rpg_page():
    st.title("⚔️ 용사 키우기 대확장 패치 (Ver 2.0)")
    st.write("화려한 전투 스킬과 궁극기를 마스터하고 10마리의 강적과 3종의 전설급 보스 레이드에 도전하세요!")

    # [💡 고품질 리팩토링] 세션 상태 변수 안전 검사 및 개별 초기화
    # 이미 다른 변수가 세션에 있어도, 새로 추가된 변수만 골라서 안전하게 생성해 줍니다.
    defaults = {
        "r_lvl": 1,
        "r_exp": 0,
        "r_max_exp": 10,
        "r_gold": 50,
        "r_max_hp": 60,
        "r_hp": 60,
        "r_b_atk": 10,
        "r_b_def": 2,
        "r_w_name": "낡은 나뭇가지",
        "r_w_atk": 0,
        "r_a_name": "천 옷",
        "r_a_def": 0,
        "r_has_skill": False,
        "r_has_ult": False,
        "r_skill_cd": 0,
        "r_ult_cd": 0,
        "r_log": ["새로운 전장에 발을 내딛습니다."],
        "r_battle": False,
        "m_cur": None
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

    total_atk = st.session_state.r_b_atk + st.session_state.r_w_atk
    total_def = st.session_state.r_b_def + st.session_state.r_a_def

    # 대시보드 UI
    st.subheader("👤 용사 능력치 프로필")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("종합 레벨", f"Lv.{st.session_state.r_lvl}")
    c2.metric("자금 보유고", f"💰 {st.session_state.r_gold} G")
    c3.metric("총 공격력", f"⚔️ {total_atk} ({st.session_state.r_b_atk}+{st.session_state.r_w_atk})")
    c4.metric("총 방어력", f"🛡️ {total_def} ({st.session_state.r_b_def}+{st.session_state.r_a_def})")

    st.write(f"❤️ **HP:** {st.session_state.r_hp} / {st.session_state.r_max_hp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_hp / st.session_state.r_max_hp)))
    st.write(f"✨ **EXP:** {st.session_state.r_exp} / {st.session_state.r_max_exp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_exp / st.session_state.r_max_exp)))

    st.divider()

    tab1, tab2, tab3 = st.tabs(["🏹 차원 던전 관문", "🛒 장비 & 무공 비급 상점", "💾 모험의 서 저장"])

    # --- 1번 탭: 10마리 몬스터 + 3마리 보스 전투 시스템 ---
    with tab1:
        enemies = {
            "🟢 초록 슬라임 (Lv.1)": {"hp": 30, "atk": 5, "def": 1, "exp": 3, "gold": 15, "is_boss": False},
            "🍄 뿔 피어싱 버섯 (Lv.3)": {"hp": 45, "atk": 8, "def": 2, "exp": 5, "gold": 25, "is_boss": False},
            "👺 홉고블린 정찰병 (Lv.6)": {"hp": 70, "atk": 13, "def": 4, "exp": 8, "gold": 40, "is_boss": False},
            "🐺 굶주린 흉포한 이리 (Lv.9)": {"hp": 100, "atk": 20, "def": 6, "exp": 12, "gold": 60, "is_boss": False},
            "🦂 치명적인 사막 전갈 (Lv.12)": {"hp": 135, "atk": 27, "def": 9, "exp": 16, "gold": 80, "is_boss": False},
            "🧟 지옥 전사 스켈레톤 (Lv.15)": {"hp": 180, "atk": 35, "def": 13, "exp": 22, "gold": 110, "is_boss": False},
            "🐗 돌격대장 흑멧돼지 (Lv.19)": {"hp": 240, "atk": 44, "def": 18, "exp": 30, "gold": 150, "is_boss": False},
            "🦅 오염된 그리폰 (Lv.23)": {"hp": 310, "atk": 54, "def": 24, "exp": 40, "gold": 200, "is_boss": False},
            "👹 광포한 사이클롭스 (Lv.27)": {"hp": 400, "atk": 66, "def": 32, "exp": 55, "gold": 270, "is_boss": False},
            "👁️ 심연의 주시자 (Lv.32)": {"hp": 520, "atk": 80, "def": 42, "exp": 75, "gold": 360, "is_boss": False},
            "🤖 [네임드 보스] 무너진 고대 유적 골렘": {"hp": 850, "atk": 110, "def": 60, "exp": 150, "gold": 600, "is_boss": True},
            "❄️ [월드 보스] 폭풍의 얼음 서리 고래": {"hp": 1600, "atk": 160, "def": 95, "exp": 300, "gold": 1200, "is_boss": True},
            "🔥 [최종 레이드 보스] 종언의 화염 드래곤": {"hp": 3200, "atk": 240, "def": 150, "exp": 1000, "gold": 5000, "is_boss": True}
        }

        if not st.session_state.r_battle:
            st.write("⚔️ 도전 상대를 마주하세요:")
            m_choice = st.selectbox("전장의 적 리스트", list(enemies.keys()))
            if st.button("⚔️ 토벌 전장 입장하기"):
                st.session_state.m_cur = enemies[m_choice].copy()
                st.session_state.m_cur["name"] = m_choice
                st.session_state.m_cur["max_hp"] = enemies[m_choice]["hp"]
                st.session_state.r_battle = True
                st.session_state.r_skill_cd = 0
                st.session_state.r_ult_cd = 0
                st.session_state.r_log.insert(0, f"[{m_choice}] 진영에 난입했습니다! 생존 투쟁이 시작됩니다.")
                st.rerun()
        else:
            m = st.session_state.m_cur
            st.error(f"👿 위협적인 적 **{m['name']}** 과 대치 중!")
            st.write(f"💥 **적 체력 정보:** {m['hp']} / {m['max_hp']}")
            st.progress(max(0.0, min(1.0, m["hp"] / m["max_hp"])))

            bc1, bc2, bc3, bc4 = st.columns(4)
            
            if bc1.button("🗡️ 기본공격", use_container_width=True):
                p_dmg = max(1, total_atk - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_log.insert(0, f"⚔️ 용사의 일반 일격! [{m['name']}]에게 {p_dmg}의 대미지!")
                enemy_turn_process(m, total_def)
                st.rerun()

            skill_label = "⚡ 전투스킬 [질풍 연격]"
            if not st.session_state.r_has_skill:
                skill_label += " (미해금)"
            elif st.session_state.r_skill_cd > 0:
                skill_label += f" ({st.session_state.r_skill_cd}턴 대기)"
            
            if bc2.button(skill_label, disabled=(not st.session_state.r_has_skill or st.session_state.r_skill_cd > 0), use_container_width=True):
                p_dmg = max(5, int(total_atk * 1.8) - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_skill_cd = 3
                st.session_state.r_log.insert(0, f"⚡ [전투스킬] 신속한 질풍 연격 폭사! [{m['name']}]에게 {p_dmg}의 파괴적 대미지!")
                enemy_turn_process(m, total_def)
                st.rerun()

            ult_label = "🔱 궁극기 [성운 붕괴 폭발]"
            if not st.session_state.r_has_ult:
                ult_label += " (미해금)"
            elif st.session_state.r_ult_cd > 0:
                ult_label += f" ({st.session_state.r_ult_cd}턴 대기)"
                
            if bc3.button(ult_label, disabled=(not st.session_state.r_has_ult or st.session_state.r_ult_cd > 0), use_container_width=True):
                p_dmg = int(total_atk * 3.2)
                m["hp"] -= p_dmg
                st.session_state.r_ult_cd = 5
                st.session_state.r_log.insert(0, f"🔱 [궁극기] 차원을 가르는 성운 붕괴 폭발 시전! 적 방어무시 {p_dmg}의 파멸적인 대미지 고정 타격!")
                enemy_turn_process(m, total_def)
                st.rerun()

            if bc4.button("🏃 후방 퇴각", use_container_width=True):
                st.session_state.r_battle = False
                st.session_state.r_log.insert(0, "💨 위기 상황을 감지하고 전장 작전구역에서 이탈했습니다.")
                st.rerun()

    # --- 2번 탭: 장비 및 무공 비급 상점 ---
    with tab2:
        st.subheader("⚔️ 무기고 대장간")
        st.write(f"현재 무기: **{st.session_state.r_w_name}** (+{st.session_state.r_w_atk}) | 현재 방어구: **{st.session_state.r_a_name}** (+{st.session_state.r_a_def})")
        st.divider()

        w_cols = st.columns(3)
        w_list = [
            {"name": "🪵 훈련용 장단 목검", "atk": 5, "price": 40},
            {"name": "⚔️ 정련된 강철 롱소드", "atk": 15, "price": 120},
            {"name": "✨ 마력 주입된 기사창", "atk": 35, "price": 320},
            {"name": "☄️ 천공의 성광 대검", "atk": 75, "price": 750},
            {"name": "🔥 드래곤 슬레이어 오리진", "atk": 160, "price": 1800}
        ]
        for idx, w in enumerate(w_list):
            with w_cols[idx % 3]:
                if st.button(f"{w['name']}\n(공격 +{w['atk']}) | 💰 {w['price']} G"):
                    if st.session_state.r_gold >= w['price']:
                        st.session_state.r_gold -= w['price']
                        st.session_state.r_w_name = w['name']
                        st.session_state.r_w_atk = w['atk']
                        st.session_state.r_log.insert(0, f"🛒 무기 [{w['name']}]을(를) 구매하여 주 무기로 커스텀 세팅했습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("군자금이 부족합니다.")

        st.divider()
        st.subheader("🛡️ 방어구 보급소")
        a_cols = st.columns(3)
        a_list = [
            {"name": "🧥 야전 가죽 장갑복", "def": 4, "price": 50},
            {"name": "⛓️ 겹강화 징 사슬갑옷", "def": 12, "price": 160},
            {"name": "🔱 성기사의 티타늄 판금 아머", "def": 30, "price": 600},
            {"name": "🌌 오로라 불멸의 성해 아머", "def": 70, "price": 1500}
        ]
        for idx, a in enumerate(a_list):
            with a_cols[idx % 3]:
                if st.button(f"{a['name']}\n(방어 +{a['def']}) | 💰 {a['price']} G"):
                    if st.session_state.r_gold >= a['price']:
                        st.session_state.r_gold -= a['price']
                        st.session_state.r_a_name = a['name']
                        st.session_state.r_a_def = a['def']
                        st.session_state.r_log.insert(0, f"🛒 신형 기갑 방어구 [{a['name']}]을(를) 인수했습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("군자금이 부족합니다.")

        st.divider()
        st.subheader("📜 영웅 무공 비급 상점 (스킬 상점)")
        s_col1, s_col2 = st.columns(2)
        
        with s_col1:
            st.write("### ⚡ 전투스킬 [질풍 연격]")
            st.write("공격력의 **1.8배** 피해를 가합니다. (재사용 대기시간: 3턴)")
            if st.session_state.r_has_skill:
                st.success("✅ 비급 연마 완료 (사용 가능)")
            else:
                if st.button("📜 질풍 연격 비급서 구매 | 💰 250 G"):
                    if st.session_state.r_gold >= 250:
                        st.session_state.r_gold -= 250
                        st.session_state.r_has_skill = True
                        st.session_state.r_log.insert(0, "✨ 스킬 [질풍 연격]을 깨달았습니다!")
                        save_rpg()
                        st.rerun()
                    else: st.error("골드가 부족합니다.")

        with s_col2:
            st.write("### 🔱 궁극기 [성운 붕괴 폭발]")
            st.write("적 방어력을 **100% 무시**하고 공격력의 **3.2배** 고정 대미지를 날립니다. (재사용 대기시간: 5턴)")
            if st.session_state.r_has_ult:
                st.success("✅ 무공 마스터 완료 (사용 가능)")
            else:
                if st.button("📜 성운 붕괴 비급서 구매 | 💰 650 G"):
                    if st.session_state.r_gold >= 650:
                        st.session_state.r_gold -= 650
                        st.session_state.r_has_ult = True
                        st.session_state.r_log.insert(0, "✨ 궁극기 [성운 붕괴 폭발] 연마에 성공했습니다!")
                        save_rpg()
                        st.rerun()
                    else: st.error("골드가 부족합니다.")

        st.divider()
        if st.button("💖 엘릭서 특급 성수 복용 (체력 전면 회복) | 💰 25 G"):
            if st.session_state.r_gold >= 25:
                if st.session_state.r_hp == st.session_state.r_max_hp:
                    st.warning("신체 에너지가 최대 충전 상태입니다.")
                else:
                    st.session_state.r_gold -= 25
                    st.session_state.r_hp = st.session_state.r_max_hp
                    st.session_state.r_log.insert(0, "🧪 성수를 흡수하여 완벽히 회복되었습니다.")
                    save_rpg()
                    st.rerun()
            else: st.error("골드가 부족합니다.")

    # --- 3번 탭: 세이브 시스템 연동부 ---
    with tab3:
        st.write("### 💾 영웅 데이터베이스 파일 입출력")
        sm1, sm2 = st.columns(2)
        if sm1.button("💾 동기화 데이터 쓰기 (Save)"):
            save_rpg()
            st.success("보유 스킬정보를 포함하여 파일에 저장되었습니다.")
        if sm2.button("📂 동기화 데이터 읽기 (Load)"):
            if load_rpg():
                st.success("성공적으로 세이브 스탯 및 스킬 정보를 불러왔습니다!")
                st.rerun()
            else: st.error("연결 가능한 세이브 파일이 로컬 디렉토리에 없습니다.")

    st.divider()
    st.write("### 📜 배틀 로깅 시스템 기록창")
    for log in st.session_state.r_log[:5]:
        st.write(log)
