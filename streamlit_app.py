import streamlit as st
import random
import json
import os

# ==========================================
# 1. 홈 화면 페이지
# ==========================================
def home_page():
    st.title("🌟 환영합니다! 나만의 첫 웹 페이지입니다.")
    st.subheader("스트림릿(Streamlit)으로 만든 멋진 첫 화면에 오신 것을 환영해요!")
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("### 💡 이 앱에 대하여")
        st.write("""
        이곳에는 웹페이지의 소개글이나 사용 방법을 적을 수 있어.
        스트림릿은 복잡한 HTML이나 CSS 없이 파이썬만으로도 
        이렇게 훌륭한 UI를 만들 수 있게 해 주는 아주 강력한 도구야.
        """)
    with col2:
        st.write("### 🛠️ 기능 테스트")
        st.write("간단한 버튼과 입력창을 테스트해 볼 수 있어.")
        user_name = st.text_input("이름을 입력해 보세요!")
        if st.button("인사하기"):
            if user_name:
                st.success(f"반가워요, {user_name}님! 멋진 프로그래밍을 응원할게요!")
            else:
                st.warning("이름을 먼저 입력해 주세요.")

# ==========================================
# 2. 업다운 게임 페이지
# ==========================================
def game_page():
    st.title("🎮 업다운(Up-Down) 게임")
    st.write("컴퓨터가 1부터 100 사이의 숫자 하나를 생각했습니다. 맞춰보세요!")

    if "target_number" not in st.session_state:
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0

    with st.form(key="updown_form", clear_on_submit=False):
        user_input = st.text_input("숫자를 입력하고 엔터를 누르세요 (1~100)")
        submit_button = st.form_submit_button(label="정답 확인")

    if submit_button:
        if user_input.isdigit():
            user_guess = int(user_input)
            
            if not st.session_state.game_over:
                st.session_state.attempts += 1
                
                if user_guess < st.session_state.target_number:
                    st.info(f"🔺 UP! 컴퓨터가 생각한 숫자가 더 큽니다. (시도 횟수: {st.session_state.attempts}회)")
                elif user_guess > st.session_state.target_number:
                    st.info(f"🔻 DOWN! 컴퓨터가 생각한 숫자가 더 작습니다. (시도 횟수: {st.session_state.attempts}회)")
                else:
                    st.success(f"🎉 정답입니다! {st.session_state.attempts}번 만에 맞추셨습니다!")
                    st.session_state.game_over = True
            else:
                st.warning("게임이 끝났습니다. 새로운 게임을 시작하려면 아래 재시작 버튼을 눌러주세요.")
        else:
            st.error("숫자만 정확하게 입력해 주세요!")

    if st.button("게임 재시작"):
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0
        st.rerun()

# ==========================================
# 3. 뱀사다리 말판 게임 페이지
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    st.write("주사위를 굴려 가장 먼저 50번 칸에 도착하는 사람이 승리합니다!")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    emojis = ["🔴", "🔵", "🟡", "🟢"]

    if "board_players" not in st.session_state:
        st.session_state.board_players = 2
    if "positions" not in st.session_state:
        st.session_state.positions = [1, 1, 1, 1]
    if "turn" not in st.session_state:
        st.session_state.turn = 0
    if "log" not in st.session_state:
        st.session_state.log = ["게임을 시작합니다!"]
    if "winner" not in st.session_state:
        st.session_state.winner = None
    if "custom_names" not in st.session_state:
        st.session_state.custom_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]

    st.subheader("👥 게임 인원 및 이름 설정")
    new_num_players = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 3, 4], index=st.session_state.board_players - 2, key="board_p_select")
    
    if new_num_players != st.session_state.board_players:
        st.session_state.board_players = new_num_players
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["인원이 변경되어 게임을 리셋합니다!"]
        st.session_state.winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with name_cols[i]:
            st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=st.session_state.custom_names[i], key=f"p_name_{i}")

    display_names = [f"{emojis[i]} {st.session_state.custom_names[i]}" for i in range(st.session_state.board_players)]

    st.divider()

    st.subheader("🗺️ 실시간 게임 보드판")
    board_html = "<div style='display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; background-color: #f5f5f5; padding: 15px; border-radius: 12px; border: 2px solid #ccc; max-width: 900px; margin: auto;'>"
    
    for r in range(4, -1, -1):
        for c in range(10):
            num = r * 10 + 1 + c if r % 2 == 0 else r * 10 + 10 - c
            
            present_players = ""
            for p_idx in range(st.session_state.board_players):
                if st.session_state.positions[p_idx] == num:
                    present_players += emojis[p_idx]
            
            bg_color = "#ffffff"
            note = ""
            border_style = "1px solid #ddd"
            
            if num == 1:
                bg_color = "#fff9db"
                note = "START"
                border_style = "2px solid #fcc419"
            elif num == 50:
                bg_color = "#e3fafc"
                note = "GOAL"
                border_style = "2px solid #22b8cf"
            elif num in ladders:
                note = f"🪜 ➔ {ladders[num]}"
                bg_color = "#ebfbee"
            elif num in snakes:
                note = f"🐍 ➔ {snakes[num]}"
                bg_color = "#fff5f5"
            
            cell_style = f"background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between;"
            board_html += f"<div style='{cell_style}'>"
            board_html += f"<div style='font-size: 12px; font-weight: bold; color: #495057; text-align: left;'>{num}</div>"
            board_html += f"<div style='font-size: 18px; margin: 2px 0; min-height: 24px;'>{present_players}</div>"
            board_html += f"<div style='font-size: 9px; color: #868e96; font-weight: bold;'>{note}</div>"
            board_html += "</div>"
            
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with cols[i]:
            st.metric(label=display_names[i], value=f"{st.session_state.positions[i]}번 칸")

    st.divider()

    if st.session_state.winner:
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 승리했습니다!")
    else:
        st.subheader(f"👉 현재 차례: {display_names[st.session_state.turn]}")
        if st.button("🎲 주사위 던지기", key="roll_dice_btn"):
            dice_roll = random.randint(1, 6)
            old_pos = st.session_state.positions[st.session_state.turn]
            new_pos = old_pos + dice_roll
            log_msg = f"{display_names[st.session_state.turn]}이(가) 주사위 {dice_roll}을(를) 굴렸습니다. ({old_pos} ➔ {new_pos})"
            
            if new_pos >= 50:
                st.session_state.positions[st.session_state.turn] = 50
                st.session_state.winner = display_names[st.session_state.turn]
                st.session_state.log.insert(0, log_msg + " 🏁 골인!!")
            else:
                if new_pos in ladders:
                    log_msg += f" 🪜 사다리! {new_pos}번에서 {ladders[new_pos]}번으로 이동!"
                    new_pos = ladders[new_pos]
                elif new_pos in snakes:
                    log_msg += f" 🐍 뱀이다! {new_pos}번에서 {snakes[new_pos]}번으로 미끄러짐..."
                    new_pos = snakes[new_pos]
                
                st.session_state.positions[st.session_state.turn] = new_pos
                st.session_state.log.insert(0, log_msg)
                st.session_state.turn = (st.session_state.turn + 1) % st.session_state.board_players
            st.rerun()

    if st.button("🔄 게임 처음부터 다시 시작", key="reset_board_btn"):
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 리셋했습니다!"]
        st.session_state.winner = None
        st.rerun()

    for msg in st.session_state.log[:5]:
        st.write(msg)

# ==========================================
# 4. 쿼리도 두뇌 게임 페이지
# ==========================================
def check_path(start, p_idx, num_p, h_walls, v_walls):
    queue = [start]
    visited = {tuple(start)}
    while queue:
        r, c = queue.pop(0)
        if p_idx == 0 and r == 0: return True
        if p_idx == 1 and r == 8: return True
        if p_idx == 2 and c == 8: return True
        if p_idx == 3 and c == 0: return True
        
        if r > 0 and (r-1, c) not in visited and not h_walls[r-1][c]:
            visited.add((r-1, c))
            queue.append([r-1, c])
        if r < 8 and (r+1, c) not in visited and not h_walls[r][c]:
            visited.add((r+1, c))
            queue.append([r+1, c])
        if c > 0 and (r, c-1) not in visited and not v_walls[r][c-1]:
            visited.add((r, c-1))
            queue.append([r, c-1])
        if c < 8 and (r, c+1) not in visited and not v_walls[r][c]:
            visited.add((r, c+1))
            queue.append([r, c+1])
    return False

def check_all_paths(positions, num_p, h_walls, v_walls):
    for i in range(num_p):
        if not check_path(positions[i], i, num_p, h_walls, v_walls):
            return False
    return True

def quoridor_page():
    st.title("🧱 🧠 전략 두뇌 게임: 쿼리도")
    emojis = ["🔴", "🔵", "🟡", "🟢"]
    
    if "q_players" not in st.session_state: st.session_state.q_players = 2
    if "q_positions" not in st.session_state: st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
    if "q_walls_h" not in st.session_state: st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
    if "q_walls_v" not in st.session_state: st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
    if "q_wall_counts" not in st.session_state: st.session_state.q_wall_counts = [10, 10, 5, 5]
    if "q_turn" not in st.session_state: st.session_state.q_turn = 0
    if "q_winner" not in st.session_state: st.session_state.q_winner = None
    if "q_names" not in st.session_state: st.session_state.q_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]
    if "q_log" not in st.session_state: st.session_state.q_log = ["게임을 시작합니다!"]

    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1, key="q_p_select")
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        st.session_state.q_names[i] = name_cols[i].text_input(f"{emojis[i]} 이름", value=st.session_state.q_names[i], key=f"q_name_{i}")

    st.divider()
    
    board_html = "<div style='display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px; background-color: #343a40; padding: 12px; border-radius: 12px; max-width: 450px; margin: auto;'>"
    for r in range(9):
        for c in range(9):
            cell_p = ""
            for p_idx in range(st.session_state.q_players):
                if st.session_state.q_positions[p_idx] == [r, c]: cell_p = emojis[p_idx]
            b_bottom = "2px solid #495057"
            b_right = "2px solid #495057"
            if r < 8 and st.session_state.q_walls_h[r][c]: b_bottom = "6px solid #ff8787"
            if c < 8 and st.session_state.q_walls_v[r][c]: b_right = "6px solid #ff8787"
            bg = "#212529"
            if r == 0: bg = "#2b3b4c"
            elif r == 8: bg = "#4c3b2b"
            cell_style = f"background-color: {bg}; border-bottom: {b_bottom}; border-right: {b_right}; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 20px;"
            board_html += f"<div style='{cell_style}'>{cell_p}</div>"
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()
    status_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        status_cols[i].metric(label=st.session_state.q_names[i], value=f"벽 {st.session_state.q_wall_counts[i]}개")

    if st.session_state.q_winner:
        st.success(f"🎉 {st.session_state.q_winner}님 승리!")
    else:
        curr = st.session_state.q_turn
        st.subheader(f"👉 차례: {emojis[curr]} {st.session_state.q_names[curr]}")
        action = st.radio("행동", ["말 이동", "벽 설치"], horizontal=True, key="q_act")
        cr, cc = st.session_state.q_positions[curr]
        
        if action == "말 이동":
            m_cols = st.columns(4)
            if m_cols[0].button("⬆️ 위", disabled=not (cr > 0 and not st.session_state.q_walls_h[cr-1][cc]), key="qu"):
                st.session_state.q_positions[curr] = [cr-1, cc]
                if curr == 0 and cr-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[1].button("⬇️ 아래", disabled=not (cr < 8 and not st.session_state.q_walls_h[cr][cc]), key="qd"):
                st.session_state.q_positions[curr] = [cr+1, cc]
                if curr == 1 and cr+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[2].button("⬅️ 왼쪽", disabled=not (cc > 0 and not st.session_state.q_walls_v[cr][cc-1]), key="ql"):
                st.session_state.q_positions[curr] = [cr, cc-1]
                if curr == 3 and cc-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[3].button("➡️ 오른쪽", disabled=not (cc < 8 and not st.session_state.q_walls_v[cr][cc]), key="qr"):
                st.session_state.q_positions[curr] = [cr, cc+1]
                if curr == 2 and cc+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
        else:
            w_type = st.selectbox("종류", ["가로 벽", "세로 벽"])
            w_row = st.number_input("행 (1~8)", 1, 8, 1) - 1
            w_col = st.number_input("열 (1~8)", 1, 8, 1) - 1
            if st.button("🧱 벽 설치"):
                ok = False
                if "가로" in w_type:
                    if not st.session_state.q_walls_h[w_row][w_col] and not st.session_state.q_walls_h[w_row][w_col+1]:
                        st.session_state.q_walls_h[w_row][w_col] = True
                        st.session_state.q_walls_h[w_row][w_col+1] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_h[w_row][w_col] = False
                            st.session_state.q_walls_h[w_row][w_col+1] = False
                else:
                    if not st.session_state.q_walls_v[w_row][w_col] and not st.session_state.q_walls_v[w_row+1][w_col]:
                        st.session_state.q_walls_v[w_row][w_col] = True
                        st.session_state.q_walls_v[w_row+1][w_col] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_v[w_row][w_col] = False
                            st.session_state.q_walls_v[w_row+1][w_col] = False
                if ok:
                    st.session_state.q_wall_counts[curr] -= 1
                    st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                    st.rerun()
                else: st.error("벽을 놓을 수 없거나 길을 완전히 막습니다!")

# ==========================================
# 5. [NEW] 저장 기능 내장 턴제 레벨업 RPG 페이지
# ==========================================
SAVE_FILE = "rpg_save_data.json"

def save_rpg():
    data = {
        "lvl": st.session_state.r_lvl,
        "exp": st.session_state.r_exp,
        "max_exp": st.session_state.r_max_exp,
        "gold": st.session_state.r_gold,
        "max_hp": st.session_state.r_max_hp,
        "hp": st.session_state.r_hp,
        "b_atk": st.session_state.r_b_atk,
        "b_def": st.session_state.r_b_def,
        "w_name": st.session_state.r_w_name,
        "w_atk": st.session_state.r_w_atk,
        "a_name": st.session_state.r_a_name,
        "a_def": st.session_state.r_a_def
    }
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_rpg():
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        st.session_state.r_lvl = data["lvl"]
        st.session_state.r_exp = data["exp"]
        st.session_state.r_max_exp = data["max_exp"]
        st.session_state.r_gold = data["gold"]
        st.session_state.r_max_hp = data["max_hp"]
        st.session_state.r_hp = data["hp"]
        st.session_state.r_b_atk = data["b_atk"]
        st.session_state.r_b_def = data["b_def"]
        st.session_state.r_w_name = data["w_name"]
        st.session_state.r_w_atk = data["w_atk"]
        st.session_state.r_a_name = data["a_name"]
        st.session_state.r_a_def = data["a_def"]
        return True
    return False

def rpg_page():
    st.title("⚔️ 레벨업 용사 키우기 (With Save System)")
    st.write("몬스터를 사냥해 골드와 경험치를 얻고, 장비를 구매해 최종 보스 **[🔥 화염 드래곤]**을 처치하세요!")

    # 데이터 초기화
    if "r_lvl" not in st.session_state:
        st.session_state.r_lvl = 1
        st.session_state.r_exp = 0
        st.session_state.r_max_exp = 10
        st.session_state.r_gold = 50
        st.session_state.r_max_hp = 60
        st.session_state.r_hp = 60
        st.session_state.r_b_atk = 10
        st.session_state.r_b_def = 2
        st.session_state.r_w_name = "낡은 나뭇가지"
        st.session_state.r_w_atk = 0
        st.session_state.r_a_name = "천 옷"
        st.session_state.r_a_def = 0
        st.session_state.r_log = ["모험의 서막이 올랐습니다!"]
        st.session_state.r_battle = False
        st.session_state.m_cur = None

    # 계산 데이터
    total_atk = st.session_state.r_b_atk + st.session_state.r_w_atk
    total_def = st.session_state.r_b_def + st.session_state.r_a_def

    # 상단 스탯 인터페이스
    st.subheader("👤 용사 정보")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("레벨", f"Lv.{st.session_state.r_lvl}")
    c2.metric("보유 골드", f"💰 {st.session_state.r_gold} G")
    c3.metric("공격력 (총합)", f"⚔️ {total_atk} ({st.session_state.r_b_atk}+{st.session_state.r_w_atk})")
    c4.metric("방어력 (총합)", f"🛡️ {total_def} ({st.session_state.r_b_def}+{st.session_state.r_a_def})")

    # 체력바 및 경험치바
    hp_ratio = max(0.0, min(1.0, st.session_state.r_hp / st.session_state.r_max_hp))
    exp_ratio = max(0.0, min(1.0, st.session_state.r_exp / st.session_state.r_max_exp))
    st.write(f"❤️ **체력:** {st.session_state.r_hp} / {st.session_state.r_max_hp}")
    st.progress(hp_ratio)
    st.write(f"✨ **경험치:** {st.session_state.r_exp} / {st.session_state.r_max_exp}")
    st.progress(exp_ratio)

    st.divider()

    # 상점/사냥/저장 탭 나누기
    tab1, tab2, tab3 = st.tabs(["🎯 던전 사냥터", "🛒 대장간 상점", "💾 게임 저장/기록"])

    # 1번 탭: 던전 사냥터
    with tab1:
        monsters = {
            "초록 슬라임 (난이도: 하)": {"hp": 30, "atk": 5, "def": 1, "exp": 3, "gold": 20},
            "홉 고블린 (난이도: 중)": {"hp": 65, "atk": 14, "def": 4, "exp": 7, "gold": 50},
            "지옥 오크 (난이도: 상)": {"hp": 140, "atk": 28, "def": 10, "exp": 18, "gold": 120},
            "🔥 화염 드래곤 (최종 보스)": {"hp": 450, "atk": 65, "def": 25, "exp": 100, "gold": 500}
        }

        if not st.session_state.r_battle:
            st.write("⚔️ 도전할 상대를 고르세요:")
            m_select = st.selectbox("몬스터 목록", list(monsters.keys()))
            if st.button("⚔️ 전장으로 진입하기"):
                st.session_state.m_cur = monsters[m_select].copy()
                st.session_state.m_cur["name"] = m_select
                st.session_state.m_cur["cur_hp"] = monsters[m_select]["hp"]
                st.session_state.r_battle = True
                st.session_state.r_log.insert(0, f"[{m_select}]이(가) 나타났다! 전투가 시작됩니다.")
                st.rerun()
        else:
            m = st.session_state.m_cur
            st.error(f"👿 **{m['name']}** 과 교전 중!")
            m_hp_ratio = max(0.0, min(1.0, m["cur_hp"] / m["hp"]))
            st.write(f"💥 **몬스터 체력:** {m['cur_hp']} / {m['hp']}")
            st.progress(m_hp_ratio)

            bc1, bc2 = st.columns(2)
            if bc1.button("⚔️ 공격 가하기", use_container_width=True):
                # 1. 플레이어 공격
                p_dmg = max(1, total_atk - m["def"])
                m["cur_hp"] -= p_dmg
                st.session_state.r_log.insert(0, f"⚔️ 용사가 [{m['name']}]에게 {p_dmg}의 치명타를 입혔습니다!")
                
                # 몬스터 사망 체크
                if m["cur_hp"] <= 0:
                    st.session_state.r_battle = False
                    st.session_state.r_gold += m["gold"]
                    st.session_state.r_exp += m["exp"]
                    st.session_state.r_log.insert(0, f"🎉 승리! [{m['name']}]을(를) 토벌하고 {m['gold']}G와 {m['exp']}EXP를 얻었습니다.")
                    
                    # 레벨업 판정
                    if st.session_state.r_exp >= st.session_state.r_max_exp:
                        st.session_state.r_lvl += 1
                        st.session_state.r_exp -= st.session_state.r_max_exp
                        st.session_state.r_max_exp = int(st.session_state.r_max_exp * 1.5)
                        st.session_state.r_max_hp += 20
                        st.session_state.r_b_atk += 4
                        st.session_state.r_b_def += 2
                        st.session_state.r_hp = st.session_state.r_max_hp
                        st.session_state.r_log.insert(0, f"✨ Level Up!! 웅장한 빛과 함께 Lv.{st.session_state.r_lvl}이 되었습니다! 스탯이 대폭 상승하고 체력이 전해집니다.")
                    
                    # 자동 저장
                    save_rpg()
                    st.rerun()

                # 2. 몬스터 역습
                m_dmg = max(1, m["atk"] - total_def)
                st.session_state.r_hp -= m_dmg
                st.session_state.r_log.insert(0, f"💥 [{m['name']}]의 반격! 용사가 {m_dmg}의 피해를 입었습니다.")

                # 플레이어 사망 체크
                if st.session_state.r_hp <= 0:
                    st.session_state.r_battle = False
                    st.session_state.r_hp = int(st.session_state.r_max_hp * 0.2) # 20%로 부활
                    lost_gold = int(st.session_state.r_gold * 0.1)
                    st.session_state.r_gold -= lost_gold
                    st.session_state.r_log.insert(0, f"💀 패배... 눈앞이 캄캄해집니다. 치료비로 {lost_gold}G를 잃고 마을에서 회복했습니다.")
                    save_rpg()
                st.rerun()

            if bc2.button("🏃 도망치기", use_container_width=True):
                st.session_state.r_battle = False
                st.session_state.r_log.insert(0, "💨 호다닥! 전투 구역에서 안전하게 탈출했습니다.")
                st.rerun()

    # 2번 탭: 대장간 상점
    with tab2:
        st.write(f"현재 무기: **{st.session_state.r_w_name}** (+{st.session_state.r_w_atk}) | 현재 방어구: **{st.session_state.r_a_name}** (+{st.session_state.r_a_def})")
        st.divider()
        
        sc1, sc2 = st.columns(2)
        with sc1:
            st.write("### 🗡️ 강철 장비 무기")
            if st.button("무쇠 롱소드 구매 (공격 +8) | 💰 100 G"):
                if st.session_state.r_gold >= 100:
                    st.session_state.r_gold -= 100
                    st.session_state.r_w_name = "무쇠 롱소드"
                    st.session_state.r_w_atk = 8
                    st.session_state.r_log.insert(0, "🛒 [무쇠 롱소드]를 구매하여 장착했습니다!")
                    save_rpg()
                    st.rerun()
                else: st.error("골드가 부족합니다.")

            if st.button("🔥 드래곤 슬레이어 (공격 +30) | 💰 450 G"):
                if st.session_state.r_gold >= 450:
                    st.session_state.r_gold -= 450
                    st.session_state.r_w_name = "🔥 드래곤 슬레이어"
                    st.session_state.r_w_atk = 30
                    st.session_state.r_log.insert(0, "🛒 레전드 장비 [드래곤 슬레이어]를 획득했습니다!")
                    save_rpg()
                    st.rerun()
                else: st.error("골드가 부족합니다.")

        with sc2:
            st.write("### 🛡️ 단단한 방어구")
            if st.button("강화 가죽 갑옷 구매 (방어 +4) | 💰 80 G"):
                if st.session_state.r_gold >= 80:
                    st.session_state.r_gold -= 80
                    st.session_state.r_a_name = "강화 가죽 갑옷"
                    st.session_state.r_a_def = 4
                    st.session_state.r_log.insert(0, "🛒 [강화 가죽 갑옷]을 구매하여 장착했습니다!")
                    save_rpg()
                    st.rerun()
                else: st.error("골드가 부족합니다.")

            if st.button("🔱 성기사의 판금 갑옷 (방어 +16) | 💰 400 G"):
                if st.session_state.r_gold >= 400:
                    st.session_state.r_gold -= 400
                    st.session_state.r_a_name = "🔱 성기사의 판금 갑옷"
                    st.session_state.r_a_def = 16
                    st.session_state.r_log.insert(0, "🛒 최종 장비 [성기사의 판금 갑옷]을 구매했습니다!")
                    save_rpg()
                    st.rerun()
                else: st.error("골드가 부족합니다.")

        st.divider()
        st.write("### 🧪 보급 물약")
        if st.button("💖 완치 포션 복용 (체력 전량 회복) | 💰 20 G"):
            if st.session_state.r_gold >= 20:
                if st.session_state.r_hp == st.session_state.r_max_hp:
                    st.warning("이미 체력이 가득 차 있습니다!")
                else:
                    st.session_state.r_gold -= 20
                    st.session_state.r_hp = st.session_state.r_max_hp
                    st.session_state.r_log.insert(0, "🧪 물약을 마셔 체력이 전부 치유되었습니다.")
                    save_rpg()
                    st.rerun()
            else: st.error("골드가 부족합니다.")

    # 3번 탭: 데이터 관리 (저장/불러오기)
    with tab3:
        st.write("### 💾 세이브 파일 수동 관리")
        st.write("전투 승리나 장비 구입 시 자동 저장이 기본 적용되지만, 여기서 안전하게 파일을 수동으로 관리할 수도 있어.")
        
        sm1, sm2 = st.columns(2)
        if sm1.button("💾 데이터 저장하기 (Save)"):
            save_rpg()
            st.success("데이터가 성공적으로 컴퓨터에 보관되었습니다! (rpg_save_data.json)")
            
        if sm2.button("📂 데이터 불러오기 (Load)"):
            if load_rpg():
                st.success("세이브 데이터를 성공적으로 가져왔습니다! 모험을 이어서 진행하세요.")
                st.rerun()
            else:
                st.error("저장된 세이브 파일이 존재하지 않습니다.")

    # 하단 로그
    st.divider()
    st.write("### 📜 전투 및 행동 전광판")
    for log in st.session_state.r_log[:5]:
        st.write(log)

# ==========================================
# 6. 메인 네비게이션 설정 (사이드바 최종 결합)
# ==========================================
st.set_page_config(
    page_title="나만의 첫 스트림릿 앱",
    page_icon="🌟",
    layout="wide"
)

home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")
rpg = st.Page(rpg_page, title="성장형 RPG 게임", icon="⚔️")  # 새 메뉴 추가

pg = st.navigation([home, game, board, quoridor, rpg])
pg.run()
